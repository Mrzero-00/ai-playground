using System;
using System.Collections.Generic;
using RCWeeklyTimeAttack.Input;
using RCWeeklyTimeAttack.Vehicle;
using UnityEngine;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace RCWeeklyTimeAttack.Race
{
    public enum RaceSessionState
    {
        Countdown,
        Racing,
        Finished
    }

    public readonly struct RaceResult
    {
        public float FinishTime { get; }
        public bool IsNewBest { get; }

        public RaceResult(float finishTime, bool isNewBest)
        {
            FinishTime = finishTime;
            IsNewBest = isNewBest;
        }
    }

    [RequireComponent(typeof(Rigidbody), typeof(CubeCarController), typeof(VehicleInputRouter))]
    public sealed class RaceSession : MonoBehaviour
    {
        private const float CountdownDuration = 3f;
        private const float GoDisplayDuration = 0.8f;

        private Rigidbody body;
        private CubeCarController controller;
        private VehicleInputRouter inputRouter;
        private WeeklyTrackManifest manifest;
        private IRaceRecordRepository recordRepository;
        private CheckpointProgress checkpointProgress;
        private Vector3 spawnPosition;
        private Quaternion spawnRotation;
        private float countdownRemaining;
        private float goDisplayRemaining;

        public event Action RaceReset;
        public event Action RaceStarted;
        public event Action<RaceResult> RaceFinished;

        public RaceSessionState State { get; private set; }
        public float ElapsedTime { get; private set; }
        public float LastFinishTime { get; private set; } = -1f;
        public float BestFinishTime { get; private set; } = -1f;
        public int AttemptNumber { get; private set; }
        public string StatusMessage { get; private set; } = "READY";
        public WeeklyTrackManifest Manifest => manifest;
        public int CurrentLap => checkpointProgress?.CurrentLap ?? 1;
        public int RequiredLapCount => manifest?.RequiredLapCount ?? 1;
        public int NextCheckpoint => checkpointProgress?.NextCheckpoint ?? 1;
        public int CheckpointCount => checkpointProgress?.CheckpointCount ?? 0;
        public int CountdownNumber => Mathf.Max(1, Mathf.CeilToInt(countdownRemaining));
        public bool IsShowingGo => State == RaceSessionState.Racing && goDisplayRemaining > 0f;
        public IReadOnlyList<float> LocalTopTimes { get; private set; } = Array.Empty<float>();

        public void Configure(
            WeeklyTrackManifest weeklyManifest,
            int checkpointCount,
            Vector3 startPosition,
            Quaternion startRotation)
        {
            body = GetComponent<Rigidbody>();
            controller = GetComponent<CubeCarController>();
            inputRouter = GetComponent<VehicleInputRouter>();
            manifest = weeklyManifest ?? throw new ArgumentNullException(nameof(weeklyManifest));
            checkpointProgress = new CheckpointProgress(checkpointCount, manifest.RequiredLapCount);
            recordRepository = new PlayerPrefsRaceRecordRepository(manifest);
            spawnPosition = startPosition;
            spawnRotation = startRotation;
            BestFinishTime = recordRepository.LoadBestTime();
            LocalTopTimes = recordRepository.LoadTopTimes();
            RestartRace();
        }

        private void Update()
        {
            if (IsRestartPressed())
            {
                RestartRace();
                return;
            }

            if (body == null)
            {
                return;
            }

            if (body.position.y < -2f || Mathf.Abs(body.position.x) > 36f || Mathf.Abs(body.position.z) > 46f)
            {
                RestartRace("COURSE RESET");
                return;
            }

            switch (State)
            {
                case RaceSessionState.Countdown:
                    countdownRemaining -= Time.unscaledDeltaTime;
                    if (countdownRemaining <= 0f)
                    {
                        StartRace();
                    }
                    break;
                case RaceSessionState.Racing:
                    ElapsedTime += Time.unscaledDeltaTime;
                    goDisplayRemaining = Mathf.Max(0f, goDisplayRemaining - Time.unscaledDeltaTime);
                    break;
            }
        }

        public void RestartRace()
        {
            RestartRace("READY");
        }

        public void RestartRace(string reason)
        {
            if (body == null || controller == null || inputRouter == null || checkpointProgress == null)
            {
                return;
            }

            controller.SetControlEnabled(false);
            inputRouter.ResetAllInput();
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;
            body.position = spawnPosition;
            body.rotation = spawnRotation;
            transform.SetPositionAndRotation(spawnPosition, spawnRotation);
            checkpointProgress.Reset();
            ElapsedTime = 0f;
            LastFinishTime = -1f;
            countdownRemaining = CountdownDuration;
            goDisplayRemaining = 0f;
            StatusMessage = reason;
            State = RaceSessionState.Countdown;
            RaceReset?.Invoke();
        }

        public void PassGate(int gateIndex)
        {
            if (State != RaceSessionState.Racing || checkpointProgress == null)
            {
                return;
            }

            int expectedBeforePass = checkpointProgress.NextCheckpoint;
            bool accepted = checkpointProgress.TryPass(gateIndex, out bool lapCompleted, out bool raceCompleted);
            if (!accepted)
            {
                if (gateIndex > 0 && gateIndex != expectedBeforePass)
                {
                    StatusMessage = $"CP {expectedBeforePass} REQUIRED";
                }
                return;
            }

            if (raceCompleted)
            {
                CompleteRace();
            }
            else if (lapCompleted)
            {
                StatusMessage = $"LAP {checkpointProgress.CurrentLap}/{manifest.RequiredLapCount}";
            }
            else
            {
                StatusMessage = $"CHECKPOINT {gateIndex}/{checkpointProgress.CheckpointCount}";
            }
        }

        private void StartRace()
        {
            AttemptNumber++;
            ElapsedTime = 0f;
            goDisplayRemaining = GoDisplayDuration;
            StatusMessage = "GO";
            State = RaceSessionState.Racing;
            controller.SetControlEnabled(true);
            RaceStarted?.Invoke();
        }

        private void CompleteRace()
        {
            State = RaceSessionState.Finished;
            LastFinishTime = ElapsedTime;
            controller.SetControlEnabled(false);
            inputRouter.ResetAllInput();
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;

            bool isNewBest = recordRepository.Submit(LastFinishTime);
            BestFinishTime = recordRepository.LoadBestTime();
            LocalTopTimes = recordRepository.LoadTopTimes();
            StatusMessage = isNewBest ? "NEW BEST" : "FINISH";
            RaceFinished?.Invoke(new RaceResult(LastFinishTime, isNewBest));
        }

        private static bool IsRestartPressed()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current?.rKey.wasPressedThisFrame ?? false;
#else
            return UnityEngine.Input.GetKeyDown(KeyCode.R);
#endif
        }
    }
}
