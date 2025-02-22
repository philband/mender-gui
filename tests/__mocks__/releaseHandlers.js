import { rest } from 'msw';

import { deploymentsApiUrl } from '../../src/js/actions/deploymentActions';
import { headerNames } from '../../src/js/api/general-api';
import { SORTING_OPTIONS } from '../../src/js/constants/appConstants';
import { customSort } from '../../src/js/helpers';
import { defaultState, releasesList } from '../mockData';

export const releaseHandlers = [
  rest.get(`${deploymentsApiUrl}/artifacts/:id/download`, (req, res, ctx) => res(ctx.json({ uri: 'https://testlocation.com/artifact.mender' }))),
  rest.delete(`${deploymentsApiUrl}/artifacts/:id`, ({ params: { id } }, res, ctx) => {
    if (id === defaultState.releases.byId.r1.Artifacts[0].id) {
      return res(ctx.status(200));
    }
    return res(ctx.status(591));
  }),
  rest.put(`${deploymentsApiUrl}/artifacts/:id`, ({ params: { id }, body: { description } }, res, ctx) => {
    if (id === defaultState.releases.byId.r1.Artifacts[0].id && description) {
      return res(ctx.status(200));
    }
    return res(ctx.status(592));
  }),
  rest.post(`${deploymentsApiUrl}/artifacts/generate`, (req, res, ctx) => res(ctx.status(200))),
  rest.post(`${deploymentsApiUrl}/artifacts`, (req, res, ctx) => res(ctx.status(200))),
  rest.get(`${deploymentsApiUrl}/deployments/releases/list`, ({ url: { searchParams } }, res, ctx) => {
    const page = Number(searchParams.get('page'));
    const perPage = Number(searchParams.get('per_page'));
    if (!page || ![1, 10, 20, 50, 100, 250, 500].includes(perPage)) {
      return res(ctx.status(593));
    }
    if (searchParams.get('device_type')) {
      return res(ctx.json([]));
    }
    if (page == 42 && !searchParams.get('name')) {
      return res(ctx.set(headerNames.total, 1), ctx.json([defaultState.releases.byId.r1]));
    }
    const sort = searchParams.get('sort');
    if (sort.includes('modified:desc')) {
      const releaseListSection = releasesList.slice(releasesList.length - 10);
      return res(ctx.set(headerNames.total, releasesList.length), ctx.json(releaseListSection));
    }
    const releaseListSection = releasesList.sort(customSort(sort.includes(SORTING_OPTIONS.desc), 'Name')).slice((page - 1) * perPage, page * perPage);
    if (searchParams.get('description') || searchParams.get('name')) {
      return res(ctx.set(headerNames.total, 1234), ctx.json(releaseListSection));
    }
    return res(ctx.set(headerNames.total, releasesList.length), ctx.json(releaseListSection));
  })
];
