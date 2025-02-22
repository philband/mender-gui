import React from 'react';
import { Provider } from 'react-redux';

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { accessTokens, defaultState, undefineds } from '../../../../tests/mockData';
import { render } from '../../../../tests/setupTests';
import AccessTokenManagement, {
  AccessTokenCreationDialog,
  AccessTokenRevocationDialog,
  AccessTokenManagement as DisconnectedAccessTokenManagement
} from './accesstokenmanagement';

const mockStore = configureStore([thunk]);

describe('UserManagement Component', () => {
  let store;
  beforeEach(() => {
    store = mockStore({
      ...defaultState,
      app: {
        ...defaultState.app,
        features: {
          ...defaultState.app.features,
          isEnterprise: true
        }
      },
      users: {
        ...defaultState.users,
        byId: {
          ...defaultState.users.byId,
          [defaultState.users.currentUser]: {
            ...defaultState.users.byId[defaultState.users.currentUser],
            tokens: accessTokens
          }
        }
      }
    });
  });

  it('renders correctly', async () => {
    const { baseElement } = render(
      <Provider store={store}>
        <AccessTokenManagement generateToken={jest.fn} getTokens={jest.fn} revokeToken={jest.fn} />
      </Provider>
    );
    const view = baseElement.firstChild.firstChild;
    expect(view).toMatchSnapshot();
    expect(view).toEqual(expect.not.stringMatching(undefineds));
  });

  it('works as expected', async () => {
    const createMock = jest.fn();
    const getMock = jest.fn();
    const removeMock = jest.fn();
    const ui = (
      <DisconnectedAccessTokenManagement
        generateToken={createMock}
        getTokens={getMock}
        revokeToken={removeMock}
        isEnterprise={false}
        rolesById={defaultState.users.rolesById}
        tokens={[]}
        userRoles={['test']}
      />
    );
    const { rerender } = render(ui);

    userEvent.click(screen.getByRole('button', { name: /generate a token/i }));
    const generateButton = screen.getByRole('button', { name: /create token/i });
    expect(generateButton).toBeDisabled();
    userEvent.type(screen.getByPlaceholderText(/name/i), 'somename');
    expect(generateButton).not.toBeDisabled();
    createMock.mockResolvedValue([Promise.resolve(), 'aNewToken']);
    act(() => userEvent.click(generateButton));
    expect(createMock).toHaveBeenCalledWith({ expiresIn: 31536000, name: 'somename' });
    await waitFor(() => rerender(ui));
    expect(screen.queryByText('aNewToken')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create token/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  [AccessTokenCreationDialog, AccessTokenRevocationDialog].forEach(async (Component, index) => {
    it(`renders ${Component.displayName || Component.name} correctly`, () => {
      const { baseElement } = render(
        <Component
          onCancel={jest.fn}
          generateToken={jest.fn}
          revokeToken={jest.fn}
          setToken={jest.fn}
          token={index ? accessTokens[0] : 'afreshtoken'}
          userRoles={[]}
        />
      );
      const view = baseElement.getElementsByClassName('MuiPaper-root')[0];
      expect(view).toMatchSnapshot();
      expect(view).toEqual(expect.not.stringMatching(undefineds));
    });
  });
});
