import * as UserConstants from '../constants/userConstants';
import { stringToBoolean } from '../helpers';

export const initialState = {
  byId: {},
  currentUser: null,
  jwtToken: null,
  qrCode: null,
  globalSettings: {
    id_attribute: 'Device ID',
    previousFilters: [],
    previousPhases: [],
    retries: 0
  },
  showHelptips: true,
  onboarding: {
    approach: null,
    artifactIncluded: null,
    complete:
      (mender_environment && stringToBoolean(mender_environment.features.isEnterprise)) ||
      (mender_environment && stringToBoolean(mender_environment.disableOnboarding)) ||
      !!JSON.parse(window.localStorage.getItem('onboardingComplete')),
    deviceType: null,
    demoArtifactPort: mender_environment && mender_environment.demoArtifactPort ? mender_environment.demoArtifactPort : 85,
    progress: 0,
    showTips: false,
    showTipsDialog: false,
    showConnectDeviceDialog: false,
    showCreateArtifactDialog: false
  },
  rolesById: {
    RBAC_ROLE_PERMIT_ALL: { title: 'Admin', allowUserManagement: true, groups: [], description: 'Full access', editable: false, permissions: [] },
    RBAC_ROLE_OBSERVER: { title: 'Read only', allowUserManagement: false, groups: [], description: '', editable: false, permissions: [] },
    RBAC_ROLE_CI: { title: 'CI', allowUserManagement: false, groups: [], description: '', editable: false, permissions: [] }
  }
};

const userReducer = (state = initialState, action) => {
  switch (action.type) {
    case UserConstants.RECEIVED_QR_CODE:
      return {
        ...state,
        qrCode: action.value
      };
    case UserConstants.SUCCESSFULLY_LOGGED_IN:
      return {
        ...state,
        jwtToken: action.value
      };
    case UserConstants.RECEIVED_USER_LIST:
      return {
        ...state,
        byId: { ...action.users }
      };
    case UserConstants.RECEIVED_USER:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.user.id]: {
            ...action.user
          }
        },
        currentUser: action.user.id
      };
    case UserConstants.CREATED_USER:
      // the new user gets a 0 as id, since this will be overwritten by the retrieved userlist anyway + there is no way to know the id before
      return {
        ...state,
        byId: {
          ...state.byId,
          0: action.user
        }
      };
    case UserConstants.REMOVED_USER: {
      const byId = state.byId;
      delete byId[action.userId];
      return {
        ...state,
        byId: {
          ...byId
        },
        currentUser: state.currentUser === action.userId ? null : state.currentUser
      };
    }
    case UserConstants.UPDATED_USER:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.userId]: {
            ...state.byId[action.userId],
            ...action.user
          }
        }
      };
    case UserConstants.SET_CURRENT_USER:
      return {
        ...state,
        currentUser: action.user
      };
    case UserConstants.RECEIVED_ROLES:
      return {
        ...state,
        rolesById: {
          ...state.rolesById,
          ...action.rolesById
        }
      };
    case UserConstants.REMOVED_ROLE: {
      let rolesById = state.rolesById;
      delete rolesById[action.roleId];
      return {
        ...state,
        rolesById
      };
    }
    case UserConstants.CREATED_ROLE:
      return {
        ...state,
        rolesById: {
          ...state.rolesById,
          [action.roleId]: {
            ...state.rolesById[action.roleId],
            ...action.role
          }
        }
      };
    case UserConstants.UPDATED_ROLE:
      return {
        ...state,
        rolesById: {
          ...state.rolesById,
          [action.roleId]: {
            ...state.rolesById[action.roleId],
            ...action.role
          }
        }
      };
    case UserConstants.SET_GLOBAL_SETTINGS:
      return {
        ...state,
        globalSettings: {
          ...state.globalSettings,
          ...action.settings
        }
      };
    case UserConstants.SET_SHOW_HELP:
      return {
        ...state,
        showHelptips: action.show
      };
    case UserConstants.SET_SHOW_ONBOARDING_HELP:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          showTips: action.show
        }
      };
    case UserConstants.SET_SHOW_ONBOARDING_HELP_DIALOG:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          showTipsDialog: action.show
        }
      };
    case UserConstants.SET_ONBOARDING_COMPLETE:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          complete: action.complete
        }
      };
    case UserConstants.SET_SHOW_CONNECT_DEVICE:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          showConnectDeviceDialog: action.show
        }
      };
    case UserConstants.SET_SHOW_CREATE_ARTIFACT:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          showCreateArtifactDialog: action.show
        }
      };
    case UserConstants.SET_ONBOARDING_PROGRESS:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          progress: action.value
        }
      };
    case UserConstants.SET_ONBOARDING_DEVICE_TYPE:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          deviceType: action.value
        }
      };
    case UserConstants.SET_ONBOARDING_APPROACH:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          approach: action.value
        }
      };
    case UserConstants.SET_ONBOARDING_ARTIFACT_INCLUDED:
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          artifactIncluded: action.value
        }
      };

    default:
      return state;
  }
};

export default userReducer;
