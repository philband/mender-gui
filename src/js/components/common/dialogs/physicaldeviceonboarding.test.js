import React from 'react';
import { Provider } from 'react-redux';

import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { defaultState, undefineds } from '../../../../../tests/mockData';
import { render } from '../../../../../tests/setupTests';
import { EXTERNAL_PROVIDER } from '../../../constants/deviceConstants';
import PhysicalDeviceOnboarding, {
  ConvertedImageNote,
  DeviceTypeSelectionStep,
  DeviceTypeTip,
  ExternalProviderTip,
  InstallationStep
} from './physicaldeviceonboarding';

const mockStore = configureStore([thunk]);

const oldHostname = window.location.hostname;

describe('PhysicalDeviceOnboarding Component', () => {
  let store;
  beforeEach(() => {
    store = mockStore({ ...defaultState });
    window.location = {
      ...window.location,
      hostname: 'hosted.mender.io'
    };
  });
  afterEach(() => {
    window.location = {
      ...window.location,
      hostname: oldHostname
    };
  });

  describe('tiny onboarding tips', () => {
    [DeviceTypeSelectionStep, InstallationStep, ConvertedImageNote, DeviceTypeTip, ExternalProviderTip, ExternalProviderTip].forEach(
      async (Component, index) => {
        it(`renders ${Component.displayName || Component.name} correctly`, () => {
          const { baseElement } = render(
            <Component
              advanceOnboarding={jest.fn}
              connectionString="test"
              docsVersion={''}
              hasConvertedImage={true}
              integrationProvider={EXTERNAL_PROVIDER['iot-hub'].provider}
              hasExternalIntegration={index % 2}
              ipAddress="test.address"
              isEnterprise={false}
              isHosted={true}
              isDemoMode={false}
              onboardingState={{ complete: false, showTips: true, showHelptips: true }}
              onSelect={jest.fn}
              selection="raspberrypi7"
              tenantToken="testtoken"
            />
          );
          const view = baseElement.firstChild;
          expect(view).toMatchSnapshot();
          expect(view).toEqual(expect.not.stringMatching(undefineds));
        });
      }
    );
  });

  it('renders correctly', async () => {
    const { baseElement } = render(
      <Provider store={store}>
        <PhysicalDeviceOnboarding progress={1} />
      </Provider>
    );
    const view = baseElement.firstChild;
    expect(view).toMatchSnapshot();
    expect(view).toEqual(expect.not.stringMatching(undefineds));
  });
});
