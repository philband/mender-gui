'use strict';

import hashString from 'md5';
import Cookies from 'universal-cookie';

import GeneralApi, { apiRoot } from '../api/general-api';
import UsersApi from '../api/users-api';
import { cleanUp, expirySet, logout } from '../auth';
import * as AppConstants from '../constants/appConstants';
import { ALL_DEVICES } from '../constants/deviceConstants';
import * as OnboardingConstants from '../constants/onboardingConstants';
import * as UserConstants from '../constants/userConstants';
import { duplicateFilter, extractErrorMessage, preformatWithRequestID } from '../helpers';
import { getCurrentUser, getOnboardingState, getUserSettings as getUserSettingsSelector } from '../selectors';
import { clearAllRetryTimers } from '../utils/retrytimer';
import { commonErrorFallback, commonErrorHandler, setOfflineThreshold, setSnackbar } from './appActions';

const cookies = new Cookies();
const {
  defaultPermissionSets,
  emptyRole,
  emptyUiPermissions,
  OWN_USER_ID,
  PermissionTypes,
  rolesById: defaultRolesById,
  twoFAStates,
  uiPermissionsById,
  uiPermissionsByArea,
  useradmApiUrl,
  useradmApiUrlv2
} = UserConstants;

const handleLoginError = (err, has2FA) => dispatch => {
  const errorText = extractErrorMessage(err);
  const is2FABackend = errorText.includes('2fa');
  if (is2FABackend && !has2FA) {
    return Promise.reject({ error: '2fa code missing' });
  }
  const twoFAError = is2FABackend ? ' and verification code' : '';
  const errorMessage = `There was a problem logging in. Please check your email${
    twoFAError ? ',' : ' and'
  } password${twoFAError}. If you still have problems, contact an administrator.`;
  return Promise.reject(dispatch(setSnackbar(preformatWithRequestID(err.response, errorMessage), null, 'Copy to clipboard')));
};

/*
  User management
*/
export const loginUser = userData => dispatch =>
  UsersApi.postLogin(`${useradmApiUrl}/auth/login`, userData)
    .catch(err => {
      cleanUp();
      return Promise.resolve(dispatch(handleLoginError(err, userData['token2fa'])));
    })
    .then(res => {
      const token = res.text;
      if (!token) {
        return;
      }
      // save token as cookie & set maxAge if noexpiry checkbox not checked
      cookies.set('JWT', token, { sameSite: 'strict', secure: true, path: '/', maxAge: expirySet() ? 900 : undefined });

      return dispatch(getUser(OWN_USER_ID))
        .then(() => {
          window.sessionStorage.removeItem('pendings-redirect');
          window.location.replace('/ui/');
          return Promise.resolve(dispatch({ type: UserConstants.SUCCESSFULLY_LOGGED_IN, value: token }));
        })
        .catch(e => {
          cleanUp();
          return Promise.reject(dispatch(setSnackbar(extractErrorMessage(e))));
        });
    });

export const logoutUser = reason => (dispatch, getState) => {
  if (getState().releases.uploadProgress) {
    return Promise.reject();
  }
  let tasks = [dispatch({ type: UserConstants.USER_LOGOUT })];
  return GeneralApi.post(`${useradmApiUrl}/auth/logout`).finally(() => {
    clearAllRetryTimers(setSnackbar);
    if (reason) {
      tasks.push(dispatch(setSnackbar(reason)));
    }
    logout();
    return Promise.all(tasks);
  });
};

export const passwordResetStart = email => dispatch =>
  GeneralApi.post(`${useradmApiUrl}/auth/password-reset/start`, { email: email }).catch(err =>
    commonErrorHandler(err, `The password reset request cannot be processed:`, dispatch, undefined, true)
  );

export const passwordResetComplete = (secretHash, newPassword) => dispatch =>
  GeneralApi.post(`${useradmApiUrl}/auth/password-reset/complete`, { secret_hash: secretHash, password: newPassword }).catch((err = {}) => {
    const { error, response = {} } = err;
    let errorMsg = '';
    if (response.status == 400) {
      errorMsg = 'the link you are using expired or the request is not valid, please try again.';
    } else {
      errorMsg = error;
    }
    dispatch(setSnackbar('The password reset request cannot be processed: ' + errorMsg));
    return Promise.reject(err);
  });

export const verifyEmailStart = () => (dispatch, getState) =>
  GeneralApi.post(`${useradmApiUrl}/auth/verify-email/start`, { email: getCurrentUser(getState()).email })
    .catch(err => commonErrorHandler(err, 'An error occured starting the email verification process:', dispatch))
    .finally(() => Promise.resolve(dispatch(getUser(OWN_USER_ID))));

export const setAccountActivationCode = code => dispatch => Promise.resolve(dispatch({ type: UserConstants.RECEIVED_ACTIVATION_CODE, code }));

export const verifyEmailComplete = secret => dispatch =>
  GeneralApi.post(`${useradmApiUrl}/auth/verify-email/complete`, { secret_hash: secret })
    .catch(err => commonErrorHandler(err, 'An error occured completing the email verification process:', dispatch))
    .finally(() => Promise.resolve(dispatch(getUser(OWN_USER_ID))));

export const verify2FA = tfaData => dispatch =>
  UsersApi.putVerifyTFA(`${useradmApiUrl}/2faverify`, tfaData)
    .then(() => Promise.resolve(dispatch(getUser(OWN_USER_ID))))
    .catch(err =>
      commonErrorHandler(err, 'An error occured validating the verification code: failed to verify token, please try again.', dispatch, undefined, true)
    );

export const getUserList = () => dispatch =>
  GeneralApi.get(`${useradmApiUrl}/users`)
    .then(res => {
      const users = res.data.reduce((accu, item) => {
        accu[item.id] = item;
        return accu;
      }, {});
      return dispatch({ type: UserConstants.RECEIVED_USER_LIST, users });
    })
    .catch(err => commonErrorHandler(err, `Users couldn't be loaded.`, dispatch, commonErrorFallback));

export const getUser = id => dispatch =>
  GeneralApi.get(`${useradmApiUrl}/users/${id}`).then(({ data: user }) =>
    Promise.all([
      dispatch({ type: UserConstants.RECEIVED_USER, user }),
      dispatch(setHideAnnouncement(false, user.id)),
      dispatch(updateUserColumnSettings(undefined, user.id)),
      user
    ])
  );

export const updateUserColumnSettings = (columns, currentUserId) => (dispatch, getState) => {
  const userId = currentUserId ?? getCurrentUser(getState()).id;
  const storageKey = `${userId}-column-widths`;
  let customColumns = [];
  if (!columns) {
    try {
      customColumns = JSON.parse(window.localStorage.getItem(storageKey)) || customColumns;
    } catch {
      // most likely the column info doesn't exist yet or is lost - continue
    }
  } else {
    customColumns = columns;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(customColumns));
  return Promise.resolve(dispatch({ type: UserConstants.SET_CUSTOM_COLUMNS, value: customColumns }));
};

const actions = {
  create: {
    successMessage: 'The user was created successfully.',
    errorMessage: 'creating'
  },
  edit: {
    successMessage: 'The user has been updated.',
    errorMessage: 'editing'
  },
  remove: {
    successMessage: 'The user was removed from the system.',
    errorMessage: 'removing'
  }
};

const userActionErrorHandler = (err, type, dispatch) => commonErrorHandler(err, `There was an error ${actions[type].errorMessage} the user.`, dispatch);

export const createUser = userData => dispatch =>
  GeneralApi.post(`${useradmApiUrl}/users`, userData)
    .then(() =>
      Promise.all([
        dispatch({ type: UserConstants.CREATED_USER, user: userData }),
        dispatch(getUserList()),
        dispatch(setSnackbar(actions.create.successMessage))
      ])
    )
    .catch(err => userActionErrorHandler(err, 'create', dispatch));

export const removeUser = userId => dispatch =>
  GeneralApi.delete(`${useradmApiUrl}/users/${userId}`)
    .then(() =>
      Promise.all([dispatch({ type: UserConstants.REMOVED_USER, userId }), dispatch(getUserList()), dispatch(setSnackbar(actions.remove.successMessage))])
    )
    .catch(err => userActionErrorHandler(err, 'remove', dispatch));

export const editUser = (userId, userData) => (dispatch, getState) => {
  return GeneralApi.put(`${useradmApiUrl}/users/${userId}`, userData).then(() =>
    Promise.all([
      dispatch({ type: UserConstants.UPDATED_USER, userId: userId === UserConstants.OWN_USER_ID ? getState().users.currentUser : userId, user: userData }),
      dispatch(setSnackbar(actions.edit.successMessage))
    ])
  );
};

export const enableUser2fa =
  (userId = OWN_USER_ID) =>
  dispatch =>
    GeneralApi.post(`${useradmApiUrl}/users/${userId}/2fa/enable`)
      .catch(err => commonErrorHandler(err, `There was an error enabling Two Factor authentication for the user.`, dispatch))
      .then(() => Promise.resolve(dispatch(getUser(userId))));

export const disableUser2fa =
  (userId = OWN_USER_ID) =>
  dispatch =>
    GeneralApi.post(`${useradmApiUrl}/users/${userId}/2fa/disable`)
      .catch(err => commonErrorHandler(err, `There was an error disabling Two Factor authentication for the user.`, dispatch))
      .then(() => Promise.resolve(dispatch(getUser(userId))));

/* RBAC related things follow:  */

const mapHttpPermission = permission =>
  Object.entries(uiPermissionsByArea).reduce((accu, [area, definition]) => {
    const endpointMatches = definition.endpoints.filter(
      endpoint => endpoint.path.test(permission.value) && (endpoint.types.includes(permission.type) || permission.type === PermissionTypes.Any)
    );
    if (permission.value === PermissionTypes.Any || (permission.value.includes(apiRoot) && endpointMatches.length)) {
      const collector = accu[area] || [];
      const endpointUiPermission = endpointMatches.reduce((endpointAccu, endpoint) => [...endpointAccu, ...endpoint.uiPermissions], []);
      accu[area] = (endpointUiPermission || definition.uiPermissions).reduce((permissionsAccu, uiPermission) => {
        if (permission.type === PermissionTypes.Any || (!endpointMatches.length && uiPermission.verbs.some(verb => verb === permission.type))) {
          permissionsAccu.push(uiPermission.value);
        }
        return permissionsAccu;
      }, collector);
    }
    return accu;
  }, {});

const permissionActionTypes = {
  any: mapHttpPermission,
  CREATE_DEPLOYMENT: permission =>
    permission.type === PermissionTypes.DeviceGroup
      ? {
          deployments: [uiPermissionsById.deploy.value],
          groups: { [permission.value]: [uiPermissionsById.deploy.value] }
        }
      : {},
  http: mapHttpPermission,
  REMOTE_TERMINAL: permission =>
    permission.type === PermissionTypes.DeviceGroup
      ? {
          groups: { [permission.value]: [uiPermissionsById.connect.value] }
        }
      : {},
  VIEW_DEVICE: permission =>
    permission.type === PermissionTypes.DeviceGroup
      ? {
          groups: { [permission.value]: [uiPermissionsById.read.value] }
        }
      : {}
};

const combineGroupPermissions = (existingGroupPermissions, additionalPermissions = {}) =>
  Object.entries(additionalPermissions).reduce((groupsAccu, [name, permissions]) => {
    let groupPermissions = groupsAccu[name] || [];
    groupsAccu[name] = [...permissions, ...groupPermissions].filter(duplicateFilter);
    return groupsAccu;
  }, existingGroupPermissions);

const mergePermissions = (existingPermissions = { ...emptyUiPermissions }, addedPermissions) =>
  Object.entries(existingPermissions).reduce((accu, [key, value]) => {
    let values;
    if (!addedPermissions[key]) {
      accu[key] = value;
      return accu;
    }
    if (Array.isArray(value)) {
      values = [...value, ...addedPermissions[key]].filter(duplicateFilter);
    } else {
      values = combineGroupPermissions({ ...value }, addedPermissions[key]);
    }
    accu[key] = values;
    return accu;
  }, {});

const tryParseCustomPermission = permission => {
  const uiPermissions = permissionActionTypes[permission.action](permission.object);
  const result = mergePermissions({ ...emptyUiPermissions }, uiPermissions);
  return { isCustom: true, permission, result };
};

const customPermissionHandler = (accu, permission) => {
  let processor = tryParseCustomPermission(permission);
  return {
    ...accu,
    isCustom: accu.isCustom || processor.isCustom,
    uiPermissions: mergePermissions(accu.uiPermissions, processor.result)
  };
};

const mapGroupPermissionSet = (permissionSetName, groupNames, existingGroupsPermissions = {}) => {
  const groupPermission = Object.values(uiPermissionsById).find(permission => permission.permissionSets.groups === permissionSetName).value;
  return groupNames.reduce((accu, groupName) => combineGroupPermissions(accu, { [groupName]: [groupPermission] }), existingGroupsPermissions);
};

const parseRolePermissions = ({ permission_sets_with_scope = [], permissions = [] }, permissionSets) => {
  const preliminaryResult = permission_sets_with_scope.reduce(
    (accu, permissionSet) => {
      let processor = permissionSets[permissionSet.name];
      if (!processor) {
        return accu;
      } else if (permissionSet.scope?.type === uiPermissionsByArea.groups.scope) {
        const groups = mapGroupPermissionSet(permissionSet.name, permissionSet.scope.value, accu.uiPermissions.groups);
        return { ...accu, uiPermissions: { ...accu.uiPermissions, groups } };
      } else if (!processor.result) {
        return processor.permissions.reduce(customPermissionHandler, accu);
      }
      return {
        ...accu,
        isCustom: accu.isCustom || processor.isCustom,
        uiPermissions: mergePermissions(accu.uiPermissions, processor.result)
      };
    },
    { isCustom: false, uiPermissions: { ...emptyUiPermissions, groups: {} } }
  );
  return permissions.reduce(customPermissionHandler, preliminaryResult);
};

export const normalizeRbacRoles = (roles, rolesById, permissionSets) =>
  roles.reduce(
    (accu, role) => {
      let normalizedPermissions;
      let isCustom = false;
      if (rolesById[role.name]) {
        normalizedPermissions = {
          ...rolesById[role.name].uiPermissions,
          groups: { ...rolesById[role.name].uiPermissions.groups }
        };
      } else {
        const result = parseRolePermissions(role, permissionSets);
        normalizedPermissions = result.uiPermissions;
        isCustom = result.isCustom;
      }

      const roleState = accu[role.name] ?? { ...emptyRole };
      accu[role.name] = {
        ...roleState,
        ...role,
        description: roleState.description ? roleState.description : role.description,
        editable: !defaultRolesById[role.name] && !isCustom && (typeof roleState.editable !== 'undefined' ? roleState.editable : true),
        isCustom,
        name: roleState.name ? roleState.name : role.name,
        uiPermissions: normalizedPermissions
      };
      return accu;
    },
    { ...rolesById }
  );

export const mapUserRolesToUiPermissions = (userRoles, roles) =>
  userRoles.reduce(
    (accu, roleId) => {
      if (!(roleId && roles[roleId])) {
        return accu;
      }
      return mergePermissions(accu, roles[roleId].uiPermissions);
    },
    { ...emptyUiPermissions }
  );

export const getPermissionSets = () => (dispatch, getState) =>
  GeneralApi.get(`${useradmApiUrlv2}/permission_sets?per_page=500`)
    .catch(() => console.log('Permission set retrieval failed - likely accessing a non-RBAC backend'))
    .then(({ data }) => {
      const permissionSets = data.reduce(
        (accu, permissionSet) => {
          const permissionSetState = accu[permissionSet.name] ?? {};
          const permissionSetObject = { ...permissionSetState, ...permissionSet };
          permissionSetObject.result = Object.values(uiPermissionsById).reduce(
            (accu, item) => {
              // eslint-disable-next-line no-unused-vars
              const { groups, ...remainingAreas } = item.permissionSets;
              accu = Object.entries(remainingAreas).reduce((collector, [area, permissionSet]) => {
                if (permissionSet === permissionSetObject.name) {
                  collector[area] = [...collector[area], item.value];
                }
                return collector;
              }, accu);
              return accu;
            },
            { ...emptyUiPermissions }
          );
          if (permissionSetObject.supported_scope_types?.includes(uiPermissionsByArea.groups.scope)) {
            permissionSetObject.result.groups = mapGroupPermissionSet(permissionSetObject.name, [ALL_DEVICES]);
          }
          accu[permissionSet.name] = permissionSetObject;
          return accu;
        },
        { ...getState().users.permissionSetsById }
      );
      return Promise.all([dispatch({ type: UserConstants.RECEIVED_PERMISSION_SETS, value: permissionSets }), permissionSets]);
    });

export const getRoles = () => (dispatch, getState) =>
  Promise.all([GeneralApi.get(`${useradmApiUrlv2}/roles?per_page=500`), dispatch(getPermissionSets())])
    .catch(() => console.log('Role retrieval failed - likely accessing a non-RBAC backend'))
    .then(results => {
      if (!results) {
        return Promise.resolve();
      }
      const [{ data: roles }, permissionSetTasks] = results;
      const rolesById = normalizeRbacRoles(roles, getState().users.rolesById, permissionSetTasks[permissionSetTasks.length - 1]);
      return Promise.resolve(dispatch({ type: UserConstants.RECEIVED_ROLES, value: rolesById }));
    });

const deriveImpliedAreaPermissions = (area, areaPermissions) => {
  const highestAreaPermissionLevelSelected = areaPermissions.reduce(
    (highest, current) => (uiPermissionsById[current].permissionLevel > highest ? uiPermissionsById[current].permissionLevel : highest),
    1
  );
  return uiPermissionsByArea[area].uiPermissions.reduce((permissions, current) => {
    if (current.permissionLevel < highestAreaPermissionLevelSelected || areaPermissions.includes(current.value)) {
      permissions.push(current.value);
    }
    return permissions;
  }, []);
};

/**
 * transforms [{ group: "groupName",  uiPermissions: ["read", "manage", "connect"] }, ...] to
 * [{ name: "ReadDevices", scope: { type: "DeviceGroups", value: ["groupName", ...] } }, ...]
 */
const transformGroupRoleDataToScopedPermissionsSets = areaPermissions => {
  const permissionSetObject = areaPermissions.reduce((groupAccu, groupWithPermissions) => {
    const impliedPermissions = deriveImpliedAreaPermissions('groups', groupWithPermissions.uiPermissions);
    groupAccu = impliedPermissions.reduce((groupPermissionAccu, groupPermission) => {
      const permissionSetState = groupAccu[uiPermissionsById[groupPermission].permissionSets.groups] ?? { type: uiPermissionsByArea.groups.scope, value: [] };
      groupAccu[uiPermissionsById[groupPermission].permissionSets.groups] = {
        ...permissionSetState,
        value: [...permissionSetState.value, groupWithPermissions.group]
      };
      return groupPermissionAccu;
    }, groupAccu);
    return groupAccu;
  }, {});
  return Object.entries(permissionSetObject).map(([name, { value, ...scope }]) => {
    if (value.includes(ALL_DEVICES)) {
      return { name };
    }
    return { name, scope: { ...scope, value: value.filter(duplicateFilter) } };
  });
};

const transformRoleDataToRole = (roleData, roleState = {}) => {
  const role = { ...roleState, ...roleData };
  // eslint-disable-next-line no-unused-vars
  const {
    description = '',
    name,
    uiPermissions: { groups }
  } = role;
  // eslint-disable-next-line no-unused-vars
  const { groups: emptyGroups, ...remainder } = emptyUiPermissions;

  const { permissionSetsWithScope, roleUiPermissions } = Object.keys(remainder).reduce(
    (accu, area) => {
      const areaPermissions = role.uiPermissions[area];
      if (!Array.isArray(areaPermissions)) {
        return accu;
      }
      const impliedPermissions = deriveImpliedAreaPermissions(area, areaPermissions);
      accu.roleUiPermissions[area] = impliedPermissions;
      const mappedPermissions = impliedPermissions.map(uiPermission => ({ name: uiPermissionsById[uiPermission].permissionSets[area] }));
      accu.permissionSetsWithScope.push(...mappedPermissions);
      return accu;
    },
    { permissionSetsWithScope: [{ name: defaultPermissionSets.Basic.value }], roleUiPermissions: {} }
  );
  const groupPermissions = transformGroupRoleDataToScopedPermissionsSets(groups);
  permissionSetsWithScope.push(...groupPermissions);
  const groupsUiPermissions = groups.reduce((accu, { group, uiPermissions }) => {
    if (group) {
      accu[group] = uiPermissions;
    }
    return accu;
  }, {});
  return {
    permissionSetsWithScope,
    role: {
      ...emptyRole,
      name,
      description: description ? description : roleState.description,
      uiPermissions: { ...emptyUiPermissions, ...roleUiPermissions, groups: groupsUiPermissions }
    }
  };
};

export const createRole = roleData => dispatch => {
  const { permissionSetsWithScope, role } = transformRoleDataToRole(roleData);
  return GeneralApi.post(`${useradmApiUrlv2}/roles`, {
    name: role.name,
    description: role.description,
    permission_sets_with_scope: permissionSetsWithScope
  })
    .then(() => Promise.all([dispatch({ type: UserConstants.CREATED_ROLE, role, roleId: role.name }), dispatch(getRoles())]))
    .catch(err => commonErrorHandler(err, `There was an error creating the role:`, dispatch));
};

export const editRole = roleData => (dispatch, getState) => {
  const { permissionSetsWithScope, role } = transformRoleDataToRole(roleData, getState().users.rolesById[roleData.name]);
  return GeneralApi.put(`${useradmApiUrlv2}/roles/${role.name}`, {
    description: role.description,
    name: role.name,
    permission_sets_with_scope: permissionSetsWithScope
  })
    .then(() => Promise.all([dispatch({ type: UserConstants.UPDATED_ROLE, role, roleId: role.name }), dispatch(getRoles())]))
    .catch(err => commonErrorHandler(err, `There was an error editing the role:`, dispatch));
};

export const removeRole = roleId => (dispatch, getState) =>
  GeneralApi.delete(`${useradmApiUrlv2}/roles/${roleId}`)
    .then(() => {
      // eslint-disable-next-line no-unused-vars
      const { [roleId]: toBeRemoved, ...rolesById } = getState().users.rolesById;
      return Promise.all([dispatch({ type: UserConstants.REMOVED_ROLE, value: rolesById }), dispatch(getRoles())]);
    })
    .catch(err => commonErrorHandler(err, `There was an error removing the role:`, dispatch));

/*
  Global settings
*/
export const getGlobalSettings = () => dispatch =>
  GeneralApi.get(`${useradmApiUrl}/settings`).then(({ data: settings, headers: { etag } }) => {
    window.sessionStorage.setItem(UserConstants.settingsKeys.initialized, true);
    return Promise.all([dispatch({ type: UserConstants.SET_GLOBAL_SETTINGS, settings }), dispatch(setOfflineThreshold()), etag]);
  });

export const saveGlobalSettings =
  (settings, beOptimistic = false, notify = false) =>
  (dispatch, getState) => {
    if (!window.sessionStorage.getItem(UserConstants.settingsKeys.initialized) && !beOptimistic) {
      return;
    }
    return Promise.resolve(dispatch(getGlobalSettings())).then(result => {
      let updatedSettings = { ...getState().users.globalSettings, ...settings };
      if (getCurrentUser(getState()).verified) {
        updatedSettings['2fa'] = twoFAStates.enabled;
      } else {
        delete updatedSettings['2fa'];
      }
      let tasks = [dispatch({ type: UserConstants.SET_GLOBAL_SETTINGS, settings: updatedSettings })];
      const headers = result[result.length - 1] ? { 'If-Match': result[result.length - 1] } : {};
      return GeneralApi.post(`${useradmApiUrl}/settings`, updatedSettings, { headers })
        .then(() => {
          if (notify) {
            tasks.push(dispatch(setSnackbar('Settings saved successfully')));
          }
          return Promise.all(tasks);
        })
        .catch(err => {
          if (beOptimistic) {
            return Promise.all([tasks]);
          }
          console.log(err);
          return commonErrorHandler(err, `The settings couldn't be saved.`, dispatch);
        });
    });
  };

export const getUserSettings = () => dispatch =>
  GeneralApi.get(`${useradmApiUrl}/settings/me`).then(({ data: settings, headers: { etag } }) => {
    window.sessionStorage.setItem(UserConstants.settingsKeys.initialized, true);
    return Promise.all([dispatch({ type: UserConstants.SET_USER_SETTINGS, settings }), etag]);
  });

export const saveUserSettings =
  (settings = { onboarding: {} }) =>
  (dispatch, getState) => {
    if (!getState().users.currentUser) {
      return Promise.resolve();
    }
    return Promise.resolve(dispatch(getUserSettings())).then(result => {
      const userSettings = getUserSettingsSelector(getState());
      const updatedSettings = {
        ...userSettings,
        ...settings,
        onboarding: {
          ...userSettings.onboarding,
          ...settings.onboarding
        }
      };
      const headers = result[result.length - 1] ? { 'If-Match': result[result.length - 1] } : {};
      return GeneralApi.post(`${useradmApiUrl}/settings/me`, updatedSettings, { headers }).then(() =>
        Promise.resolve(dispatch({ type: UserConstants.SET_USER_SETTINGS, settings: updatedSettings }))
      );
    });
  };

export const get2FAQRCode = () => dispatch =>
  GeneralApi.get(`${useradmApiUrl}/2faqr`).then(res => dispatch({ type: UserConstants.RECEIVED_QR_CODE, value: res.data.qr }));

/*
  Onboarding
*/
export const setShowHelptips = show => (dispatch, getState) => {
  let tasks = [dispatch({ type: UserConstants.SET_SHOW_HELP, show }), dispatch(saveUserSettings({ showHelptips: show }))];
  if (!getOnboardingState(getState()).complete) {
    tasks.push(dispatch({ type: OnboardingConstants.SET_SHOW_ONBOARDING_HELP, show }));
  }
  return Promise.all(tasks);
};

export const toggleHelptips = () => (dispatch, getState) => {
  const showHelptips = getUserSettingsSelector(getState()).showHelptips;
  return Promise.resolve(dispatch(setShowHelptips(!showHelptips)));
};

export const setShowConnectingDialog = show => dispatch => dispatch({ type: UserConstants.SET_SHOW_CONNECT_DEVICE, show: Boolean(show) });

export const setHideAnnouncement = (shouldHide, userId) => (dispatch, getState) => {
  const currentUserId = userId || getCurrentUser(getState()).id;
  const hash = getState().app.hostedAnnouncement ? hashString(getState().app.hostedAnnouncement) : '';
  const announceCookie = cookies.get(`${currentUserId}${hash}`);
  if (shouldHide || (hash.length && typeof announceCookie !== 'undefined')) {
    cookies.set(`${currentUserId}${hash}`, true, { maxAge: 604800 });
    return Promise.resolve(dispatch({ type: AppConstants.SET_ANNOUNCEMENT, announcement: undefined }));
  }
  return Promise.resolve();
};

export const getTokens = () => (dispatch, getState) =>
  GeneralApi.get(`${useradmApiUrl}/settings/tokens`).then(({ data: tokens }) => {
    const user = getCurrentUser(getState());
    const updatedUser = {
      ...user,
      tokens
    };
    return Promise.resolve(dispatch({ type: UserConstants.UPDATED_USER, user: updatedUser, userId: user.id }));
  });

const ONE_YEAR = 31536000;

export const generateToken =
  ({ expiresIn = ONE_YEAR, name }) =>
  dispatch =>
    GeneralApi.post(`${useradmApiUrl}/settings/tokens`, { name, expires_in: expiresIn })
      .then(({ data: token }) => Promise.all([dispatch(getTokens()), token]))
      .catch(err => commonErrorHandler(err, 'There was an error creating the token:', dispatch));

export const revokeToken = token => dispatch =>
  GeneralApi.delete(`${useradmApiUrl}/settings/tokens/${token.id}`).then(() => Promise.resolve(dispatch(getTokens())));
