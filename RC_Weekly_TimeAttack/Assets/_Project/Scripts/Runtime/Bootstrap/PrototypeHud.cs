using System.Text;
using RCWeeklyTimeAttack.Input;
using RCWeeklyTimeAttack.Race;
using RCWeeklyTimeAttack.Replay;
using RCWeeklyTimeAttack.Vehicle;
using UnityEngine;
using UnityEngine.UI;

namespace RCWeeklyTimeAttack.Bootstrap
{
    public sealed class PrototypeHud : MonoBehaviour
    {
        [SerializeField] private Text output;
        [SerializeField] private Text raceBanner;
        [SerializeField] private Text leaderboard;
        [SerializeField] private VehicleTelemetry telemetry;
        [SerializeField] private SteeringModeController steeringMode;
        [SerializeField] private RaceSession raceSession;
        [SerializeField] private GhostPlayback ghostPlayback;
        [SerializeField] private ReplayRecorder replayRecorder;

        public void Configure(
            Text targetOutput,
            Text targetRaceBanner,
            Text targetLeaderboard,
            VehicleTelemetry targetTelemetry,
            SteeringModeController modeController,
            RaceSession targetRaceSession,
            GhostPlayback targetGhostPlayback,
            ReplayRecorder targetReplayRecorder)
        {
            output = targetOutput;
            raceBanner = targetRaceBanner;
            leaderboard = targetLeaderboard;
            telemetry = targetTelemetry;
            steeringMode = modeController;
            raceSession = targetRaceSession;
            ghostPlayback = targetGhostPlayback;
            replayRecorder = targetReplayRecorder;
        }

        private void Update()
        {
            if (output == null || telemetry == null || raceSession == null)
            {
                return;
            }

            VehicleTelemetrySnapshot snapshot = telemetry.Snapshot;
            string mode = steeringMode != null ? steeringMode.CurrentMode.ToString().ToUpperInvariant() : "UNKNOWN";
            string drift = snapshot.IsDrifting
                ? $"DRIFT {Mathf.Abs(snapshot.SlipAngle):0}°"
                : $"GRIP {snapshot.DriftBlend:0.00}";
            string ghost = ghostPlayback != null && ghostPlayback.HasGhost ? "GHOST ON" : "GHOST --";
            string checkpoint = raceSession.NextCheckpoint > raceSession.CheckpointCount
                ? "NEXT FINISH"
                : $"NEXT CP {raceSession.NextCheckpoint}/{raceSession.CheckpointCount}";
            output.text =
                $"{raceSession.Manifest.WeekId}  |  {raceSession.Manifest.TrackId.ToUpperInvariant()}  |  " +
                $"TRY {raceSession.AttemptNumber + (raceSession.State == RaceSessionState.Countdown ? 1 : 0)}  |  " +
                $"LAP {raceSession.CurrentLap}/{raceSession.RequiredLapCount}\n" +
                $"TIME {RaceTimeFormatter.Format(raceSession.ElapsedTime)}  |  " +
                $"BEST {RaceTimeFormatter.Format(raceSession.BestFinishTime)}  |  " +
                $"{checkpoint}\n" +
                $"{snapshot.ForwardSpeed * 3.6f:0} km/h  |  {mode}  |  {drift}  |  {ghost}  |  {raceSession.StatusMessage}";

            UpdateBanner();
            UpdateLeaderboard();
        }

        private void UpdateBanner()
        {
            if (raceBanner == null)
            {
                return;
            }

            switch (raceSession.State)
            {
                case RaceSessionState.Countdown:
                    raceBanner.text = raceSession.CountdownNumber.ToString();
                    raceBanner.color = Color.white;
                    break;
                case RaceSessionState.Racing when raceSession.IsShowingGo:
                    raceBanner.text = "GO!";
                    raceBanner.color = new Color(0.22f, 1f, 0.45f);
                    break;
                case RaceSessionState.Finished:
                    raceBanner.text =
                        $"{raceSession.StatusMessage}\n" +
                        $"{RaceTimeFormatter.Format(raceSession.LastFinishTime)}\n" +
                        "RESTART TO TRY AGAIN";
                    raceBanner.color = raceSession.StatusMessage == "NEW BEST"
                        ? new Color(1f, 0.86f, 0.16f)
                        : Color.white;
                    break;
                default:
                    raceBanner.text = string.Empty;
                    break;
            }
        }

        private void UpdateLeaderboard()
        {
            if (leaderboard == null)
            {
                return;
            }

            StringBuilder builder = new("LOCAL TOP 5\n");
            if (raceSession.LocalTopTimes.Count == 0)
            {
                builder.Append("NO FINISH YET");
            }
            else
            {
                for (int index = 0; index < raceSession.LocalTopTimes.Count; index++)
                {
                    builder.Append(index + 1)
                        .Append(".  ")
                        .Append(RaceTimeFormatter.Format(raceSession.LocalTopTimes[index]))
                        .Append('\n');
                }
            }

            if (replayRecorder != null && !string.IsNullOrEmpty(replayRecorder.LastValidationMessage))
            {
                builder.Append('\n').Append(replayRecorder.LastValidationMessage);
            }

            leaderboard.text = builder.ToString();
        }
    }
}
