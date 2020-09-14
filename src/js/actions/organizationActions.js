import Cookies from 'universal-cookie';

import { setSnackbar } from './appActions';
import Api, { headerNames } from '../api/general-api';
import OrganizationConstants from '../constants/organizationConstants';
import { preformatWithRequestID } from '../helpers';

const cookies = new Cookies();
const apiUrlv1 = '/api/management/v1';
const apiUrlv2 = '/api/management/v2';
const auditLogsApiUrl = `${apiUrlv1}/auditlogs`;
const tenantadmApiUrlv1 = `${apiUrlv1}/tenantadm`;
const tenantadmApiUrlv2 = `${apiUrlv2}/tenantadm`;

export const cancelRequest = (tenantId, reason) => dispatch =>
  Api.post(`${tenantadmApiUrlv2}/tenants/${tenantId}/cancel`, { reason: reason }).then(() =>
    Promise.resolve(dispatch(setSnackbar('Deactivation request was sent successfully', 5000, '')))
  );

export const createOrganizationTrial = data => dispatch =>
  Api.postUnauthorized(`${tenantadmApiUrlv2}/tenants/trial`, data)
    .catch(err => {
      if (err.response.status >= 400 && err.response.status < 500) {
        dispatch(setSnackbar(err.response.data.error, 5000, ''));
        return Promise.reject(err);
      }
    })
    .then(res => {
      cookies.set('JWT', res.text, { maxAge: 900, sameSite: 'strict' });
      cookies.remove('oauth');
      cookies.remove('externalID');
      cookies.remove('email');
      return Promise.resolve(res);
    });

export const startUpgrade = tenantId => dispatch =>
  Api.post(`${tenantadmApiUrlv2}/tenants/${tenantId}/upgrade/start`).catch(err => {
    dispatch(setSnackbar(preformatWithRequestID(err.response, err.response.data?.error.message), null, 'Copy to clipboard'));
    return Promise.reject(err);
  });
export const cancelUpgrade = tenantId => () => Api.post(`${tenantadmApiUrlv2}/tenants/${tenantId}/upgrade/cancel`);
export const completeUpgrade = (tenantId, plan) => dispatch =>
  Api.post(`${tenantadmApiUrlv2}/tenants/${tenantId}/upgrade/complete`, { plan: plan }).catch(err => {
    dispatch(setSnackbar(preformatWithRequestID(err.response, `There was an error upgrading your account. ${err.response.data.error}`)));
    return Promise.reject(err);
  });

export const getAuditLogs = (page, perPage, startDate, endDate, userId, type, group, sort = 'desc') => (dispatch, getState) => {
  const created_after = startDate ? `&created_after=${Math.round(Date.parse(startDate) / 1000)}` : '';
  const created_before = endDate ? `&created_before=${Math.round(Date.parse(endDate) / 1000)}` : '';
  const typeSearch = type ? `&object_type=${type}` : '';
  const userSearch = userId ? `&actor_id=${userId}` : '';
  const objectSearch = group ? `&object_id=${group}` : '';
  return Api.get(
    `${auditLogsApiUrl}/logs?page=${page}&per_page=${perPage}${created_after}${created_before}${userSearch}${typeSearch}${objectSearch}&sort=${sort}`
  )
    .then(res => {
      const total = Number(res.headers[headerNames.total]);
      return Promise.resolve(
        dispatch({ type: OrganizationConstants.RECEIVE_AUDIT_LOGS, events: [...getState().organization.events, ...res.data.events], total })
      );
    })
    .catch(err => {
      console.log(err);
      return Promise.resolve(
        dispatch({ type: OrganizationConstants.RECEIVE_AUDIT_LOGS, events: getState().organization.events, total: getState().organization.events.length })
      );
      // dispatch(setSnackbar(preformatWithRequestID(err.response, err.response.data.error.message), null, 'Copy to clipboard'));
      // return Promise.reject(err);
    });
};

export const getAllAuditLogs = (startDate, endDate, userId, type, group, sort = 'desc') => (_, getState) => {
  const created_after = startDate ? `&created_after=${Math.round(Date.parse(startDate) / 1000)}` : '';
  const created_before = endDate ? `&created_before=${Math.round(Date.parse(endDate) / 1000)}` : '';
  const typeSearch = type ? `&object_type=${type}` : '';
  const userSearch = userId ? `&actor_id=${userId}` : '';
  const objectSearch = group ? `&object_id=${group}` : '';

  const getLogs = (perPage = 500, page = 1, logEntries = []) =>
    Api.get(`${auditLogsApiUrl}/logs?page=${page}&per_page=${perPage}${created_after}${created_before}${userSearch}${typeSearch}${objectSearch}&sort=${sort}`)
      .then(res => {
        const total = Number(res.headers[headerNames.total]);
        const entries = logEntries.concat(res.data);
        if (total > perPage * page) {
          return getLogs(perPage, page + 1, entries);
        }
        return Promise.resolve(entries);
      })
      .catch(err => {
        console.log(err);
        return Promise.resolve(getState().organization.events);
        // dispatch(setSnackbar(preformatWithRequestID(err.response, err.response.data.error.message), null, 'Copy to clipboard'));
        // return Promise.reject(err);
      });
  return getLogs();
};

/*
  Tenant management + Hosted Mender
*/
export const getUserOrganization = () => dispatch =>
  Api.get(`${tenantadmApiUrlv1}/user/tenant`).then(res => Promise.resolve(dispatch({ type: OrganizationConstants.SET_ORGANIZATION, organization: res.data })));
