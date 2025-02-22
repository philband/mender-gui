import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { Button } from '@mui/material';
import { withStyles } from 'tss-react/mui';

import { bindActionCreators } from 'redux';

import { getDeviceById, getDevicesByStatus } from '../../actions/deviceActions';
import { advanceOnboarding, setOnboardingComplete, setShowCreateArtifactDialog } from '../../actions/onboardingActions';
import * as DeviceConstants from '../../constants/deviceConstants';
import { onboardingSteps } from '../../constants/onboardingConstants';
import { getDemoDeviceAddress } from '../../selectors';
import Tracking from '../../tracking';
import Loader from '../common/loader';
import { MenderTooltipClickable } from '../common/mendertooltip';

export const CompletionButton = withStyles(Button, ({ palette }) => ({
  root: {
    backgroundColor: palette.background.default,
    '&:hover': {
      backgroundColor: palette.background.default
    }
  }
}));

export const DeploymentCompleteTip = ({
  advanceOnboarding,
  anchor,
  getDeviceById,
  getDevicesByStatus,
  setShowCreateArtifactDialog,
  setOnboardingComplete,
  url
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    getDevicesByStatus(DeviceConstants.DEVICE_STATES.accepted).then(tasks => tasks[tasks.length - 1].deviceAccu.ids.map(getDeviceById));
    Tracking.event({ category: 'onboarding', action: onboardingSteps.DEPLOYMENTS_PAST_COMPLETED });
  }, []);

  const onClick = () => {
    const parametrizedAddress = `${url}/index.html?source=${encodeURIComponent(window.location)}`;
    window.open(parametrizedAddress, '_blank');
    advanceOnboarding(onboardingSteps.DEPLOYMENTS_PAST_COMPLETED_FAILURE);
    setOnboardingComplete(false);
    setShowCreateArtifactDialog(true);
    navigate('/releases');
  };

  return (
    <MenderTooltipClickable
      className="tooltip onboard-icon onboard-tip"
      id={onboardingSteps.DEPLOYMENTS_PAST_COMPLETED}
      onboarding
      startOpen
      style={anchor}
      PopperProps={{ style: { marginLeft: -30, marginTop: -20 } }}
      title={
        <div className="content">
          <p>Fantastic! You completed your first deployment!</p>
          <p>Your deployment is finished and your device is now running the updated software!</p>
          <div className="flexbox centered">
            {!url ? <Loader show={true} /> : <CompletionButton variant="text" onClick={onClick}>{`Go to ${url}`}</CompletionButton>}
          </div>
          <p>and you should see the demo web application actually being run on the device.</p>
          <p>NOTE: if you have local network restrictions, you may need to check them if you have difficulty loading the page.</p>
          <a onClick={onClick}>Visit the web app running your device</a>
        </div>
      }
    >
      <CheckCircleIcon />
    </MenderTooltipClickable>
  );
};

const mapDispatchToProps = dispatch => {
  return bindActionCreators({ advanceOnboarding, getDeviceById, getDevicesByStatus, setOnboardingComplete, setShowCreateArtifactDialog }, dispatch);
};

const mapStateToProps = (state, ownProps) => {
  return {
    url: getDemoDeviceAddress(state) || ownProps.targetUrl
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(DeploymentCompleteTip);
