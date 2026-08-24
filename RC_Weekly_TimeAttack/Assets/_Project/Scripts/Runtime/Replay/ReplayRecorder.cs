using System.Collections.Generic;
using RCWeeklyTimeAttack.Race;
using RCWeeklyTimeAttack.Vehicle;
using UnityEngine;

namespace RCWeeklyTimeAttack.Replay
{
    public sealed class ReplayRecorder : MonoBehaviour
    {
        private const float SampleInterval = 0.1f;
        private const int MaximumFrameCount = 2400;

        private readonly List<ReplayFrame> frames = new();
        private RaceSession session;
        private VehicleTelemetry telemetry;
        private IReplayRepository repository;
        private float maximumSpeed;
        private float nextSampleTime;
        private bool isRecording;

        public string LastValidationMessage { get; private set; } = string.Empty;

        public void Configure(
            RaceSession raceSession,
            VehicleTelemetry vehicleTelemetry,
            WeeklyTrackManifest manifest,
            float replayMaximumSpeed)
        {
            session = raceSession;
            telemetry = vehicleTelemetry;
            repository = new PlayerPrefsReplayRepository(manifest);
            maximumSpeed = replayMaximumSpeed;
            session.RaceReset += HandleRaceReset;
            session.RaceStarted += HandleRaceStarted;
            session.RaceFinished += HandleRaceFinished;
        }

        private void Update()
        {
            if (!isRecording || session == null || telemetry == null || frames.Count >= MaximumFrameCount)
            {
                return;
            }

            if (session.ElapsedTime + 0.0001f >= nextSampleTime)
            {
                Capture(session.ElapsedTime);
                nextSampleTime += SampleInterval;
            }
        }

        private void HandleRaceReset()
        {
            isRecording = false;
            frames.Clear();
        }

        private void HandleRaceStarted()
        {
            frames.Clear();
            nextSampleTime = 0f;
            isRecording = true;
            Capture(0f);
            nextSampleTime = SampleInterval;
        }

        private void HandleRaceFinished(RaceResult result)
        {
            if (!isRecording)
            {
                return;
            }

            isRecording = false;
            Capture(result.FinishTime);

            if (!result.IsNewBest)
            {
                return;
            }

            ReplayData data = new(session.Manifest.StorageKey, result.FinishTime, frames);
            if (ReplayValidator.IsPlausible(data, maximumSpeed, out string reason))
            {
                repository.Save(data);
                LastValidationMessage = "BEST GHOST SAVED";
            }
            else
            {
                LastValidationMessage = $"GHOST REJECTED: {reason}";
                Debug.LogWarning(LastValidationMessage, this);
            }
        }

        private void Capture(float time)
        {
            VehicleTelemetrySnapshot snapshot = telemetry.Snapshot;
            ReplayFrame frame = new(
                time,
                snapshot.Position,
                snapshot.Rotation,
                snapshot.Steering,
                snapshot.Throttle,
                snapshot.Brake);

            if (frames.Count > 0 && Mathf.Abs(frames[^1].time - time) < 0.001f)
            {
                frames[^1] = frame;
            }
            else
            {
                frames.Add(frame);
            }
        }

        private void OnDestroy()
        {
            if (session == null)
            {
                return;
            }

            session.RaceReset -= HandleRaceReset;
            session.RaceStarted -= HandleRaceStarted;
            session.RaceFinished -= HandleRaceFinished;
        }
    }
}
