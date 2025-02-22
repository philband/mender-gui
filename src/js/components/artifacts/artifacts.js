import React, { useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import { CloudUpload } from '@mui/icons-material';
import { Button } from '@mui/material';

import { setSnackbar } from '../../actions/appActions';
import { advanceOnboarding, setShowCreateArtifactDialog } from '../../actions/onboardingActions';
import { createArtifact, getReleases, removeArtifact, selectRelease, setReleasesListState, uploadArtifact } from '../../actions/releaseActions';
import { TIMEOUTS } from '../../constants/appConstants';
import { onboardingSteps } from '../../constants/onboardingConstants';
import { defaultVisibleSection } from '../../constants/releaseConstants';
import { getDeviceTypes, getOnboardingState, getReleasesList, getUserCapabilities } from '../../selectors';
import { useDebounce } from '../../utils/debouncehook';
import { getOnboardingComponentFor } from '../../utils/onboardingmanager';
import InfoHint from '../common/info-hint';
import AddArtifactDialog from './dialogs/addartifact';
import ReleaseRepository from './releaserepository';
import ReleasesList from './releaseslist';

const refreshArtifactsLength = 60000;

export const Artifacts = props => {
  const {
    canUpload,
    getReleases,
    onboardingState,
    releases,
    releasesListState,
    selectedRelease,
    selectRelease,
    setReleasesListState,
    setShowCreateArtifactDialog
  } = props;

  const [doneLoading, setDoneLoading] = useState(!!releases.length);
  const [selectedFile, setSelectedFile] = useState();
  const [showAddArtifactDialog, setShowAddArtifactDialog] = useState(false);
  const uploadButtonRef = useRef();
  const artifactTimer = useRef();
  const navigate = useNavigate();
  const { artifactVersion } = useParams();

  const { searchTerm, sort = {}, visibleSection = {} } = releasesListState;
  const debouncedSearchTerm = useDebounce(searchTerm, TIMEOUTS.debounceDefault);

  useEffect(() => {
    clearInterval(artifactTimer.current);
    artifactTimer.current = setInterval(onGetReleases, refreshArtifactsLength);
    onGetReleases();
    return () => {
      clearInterval(artifactTimer.current);
    };
  }, [debouncedSearchTerm, sort.attribute, sort.direction, visibleSection.start]);

  useEffect(() => {
    if (!releases.length) {
      return;
    }
    if (selectedRelease) {
      navigate(`/releases/${encodeURIComponent(selectedRelease.Name)}`, { replace: true });
      return;
    }
    selectRelease(releases[0]);
  }, [releases.length, selectedRelease]);

  useEffect(() => {
    setReleasesListState({ visibleSection: { ...defaultVisibleSection } });
    if (artifactVersion) {
      selectRelease(decodeURIComponent(artifactVersion));
    }
    return () => {
      setReleasesListState({ visibleSection: { ...defaultVisibleSection } });
      clearInterval(artifactTimer.current);
    };
  }, []);

  const onGetReleases = artifactVersion =>
    getReleases({ visibleSection }).finally(() => {
      if (artifactVersion) {
        selectRelease(artifactVersion);
      }
      setDoneLoading(true);
    });

  const onUploadClick = () => {
    if (releases.length) {
      advanceOnboarding(onboardingSteps.UPLOAD_NEW_ARTIFACT_TIP);
    }
    setShowAddArtifactDialog(true);
  };

  const onFileUploadClick = selectedFile => {
    setSelectedFile(selectedFile);
    setShowAddArtifactDialog(true);
  };

  let uploadArtifactOnboardingComponent = null;
  if (!onboardingState.complete && uploadButtonRef.current) {
    uploadArtifactOnboardingComponent = getOnboardingComponentFor(
      onboardingSteps.UPLOAD_NEW_ARTIFACT_TIP,
      { ...onboardingState, setShowCreateArtifactDialog },
      {
        place: 'right',
        anchor: {
          left: uploadButtonRef.current.offsetLeft + uploadButtonRef.current.offsetWidth,
          top: uploadButtonRef.current.offsetTop + uploadButtonRef.current.offsetHeight / 2
        }
      }
    );
  }

  const onUploadFinished = releaseName => getReleases().then(() => selectRelease(releaseName));

  return (
    <>
      <div className="repository">
        <div className="flexbox column leftFixed">
          <ReleasesList
            loading={!doneLoading}
            releases={releases}
            releasesListState={releasesListState}
            selectedRelease={selectedRelease}
            setReleasesListState={setReleasesListState}
            onSelect={selectRelease}
          />
          {canUpload && (
            <>
              {' '}
              <Button
                ref={uploadButtonRef}
                color="secondary"
                onClick={onUploadClick}
                startIcon={<CloudUpload fontSize="small" />}
                style={{ marginTop: 30, minWidth: 164, justifySelf: 'left' }}
                variant="contained"
              >
                Upload
              </Button>
              <InfoHint content="Upload an Artifact to an existing or new Release" />
              {!!uploadArtifactOnboardingComponent && !showAddArtifactDialog && uploadArtifactOnboardingComponent}
            </>
          )}
        </div>
        <ReleaseRepository refreshArtifacts={onGetReleases} loading={!doneLoading} onUpload={onFileUploadClick} />
      </div>
      {showAddArtifactDialog && (
        <AddArtifactDialog
          {...props}
          onCancel={() => setShowAddArtifactDialog(false)}
          onUploadStarted={() => setShowAddArtifactDialog(false)}
          onUploadFinished={onUploadFinished}
          selectedFile={selectedFile}
        />
      )}
    </>
  );
};

const actionCreators = {
  advanceOnboarding,
  createArtifact,
  getReleases,
  removeArtifact,
  selectRelease,
  setReleasesListState,
  setShowCreateArtifactDialog,
  setSnackbar,
  uploadArtifact
};

const mapStateToProps = state => {
  const { canUploadReleases: canUpload } = getUserCapabilities(state);
  return {
    canUpload,
    deviceTypes: getDeviceTypes(state),
    onboardingState: getOnboardingState(state),
    pastCount: state.deployments.byStatus.finished.total,
    releases: getReleasesList(state),
    selectedArtifact: state.releases.selectedArtifact,
    selectedRelease: state.releases.byId[state.releases.selectedRelease],
    releasesListState: state.releases.releasesList,
    showRemoveDialog: state.releases.showRemoveDialog
  };
};

export default connect(mapStateToProps, actionCreators)(Artifacts);
