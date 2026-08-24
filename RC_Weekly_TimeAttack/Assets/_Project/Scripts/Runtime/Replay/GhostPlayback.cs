using RCWeeklyTimeAttack.Race;
using UnityEngine;

namespace RCWeeklyTimeAttack.Replay
{
    public sealed class GhostPlayback : MonoBehaviour
    {
        private RaceSession session;
        private IReplayRepository repository;
        private Transform ghostVisual;
        private ReplayData replay;
        private int frameCursor;

        public bool HasGhost => replay?.frames != null && replay.frames.Count >= 2;

        public void Configure(
            RaceSession raceSession,
            Transform targetVisual,
            WeeklyTrackManifest manifest)
        {
            session = raceSession;
            ghostVisual = targetVisual;
            repository = new PlayerPrefsReplayRepository(manifest);
            session.RaceReset += HandleRaceReset;
            session.RaceStarted += HandleRaceStarted;
            session.RaceFinished += HandleRaceFinished;
            ghostVisual.gameObject.SetActive(false);
        }

        private void Update()
        {
            if (!HasGhost || session == null || session.State != RaceSessionState.Racing)
            {
                return;
            }

            float time = session.ElapsedTime;
            while (frameCursor + 1 < replay.frames.Count && replay.frames[frameCursor + 1].time < time)
            {
                frameCursor++;
            }

            if (frameCursor + 1 >= replay.frames.Count)
            {
                ghostVisual.gameObject.SetActive(false);
                return;
            }

            ReplayFrame from = replay.frames[frameCursor];
            ReplayFrame to = replay.frames[frameCursor + 1];
            float duration = Mathf.Max(0.0001f, to.time - from.time);
            float interpolation = Mathf.Clamp01((time - from.time) / duration);
            ghostVisual.SetPositionAndRotation(
                Vector3.Lerp(from.position, to.position, interpolation),
                Quaternion.Slerp(from.rotation, to.rotation, interpolation));
        }

        private void HandleRaceReset()
        {
            replay = null;
            frameCursor = 0;
            ghostVisual.gameObject.SetActive(false);
        }

        private void HandleRaceStarted()
        {
            replay = repository.Load();
            frameCursor = 0;
            ghostVisual.gameObject.SetActive(HasGhost);
        }

        private void HandleRaceFinished(RaceResult result)
        {
            ghostVisual.gameObject.SetActive(false);
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
