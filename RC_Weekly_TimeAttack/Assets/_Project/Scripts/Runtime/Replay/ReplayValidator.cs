using UnityEngine;

namespace RCWeeklyTimeAttack.Replay
{
    public static class ReplayValidator
    {
        public static bool IsPlausible(ReplayData data, float maximumSpeed, out string reason)
        {
            if (data?.frames == null || data.frames.Count < 2)
            {
                reason = "Replay needs at least two frames.";
                return false;
            }

            if (!IsFinite(data.finishTime) || data.finishTime <= 0f)
            {
                reason = "Finish time is invalid.";
                return false;
            }

            float speedLimit = Mathf.Max(1f, maximumSpeed) * 1.75f;
            ReplayFrame previous = data.frames[0];
            if (!IsFinite(previous.time) || !IsFinite(previous.position))
            {
                reason = "First frame is invalid.";
                return false;
            }

            for (int index = 1; index < data.frames.Count; index++)
            {
                ReplayFrame current = data.frames[index];
                float deltaTime = current.time - previous.time;
                if (!IsFinite(current.time) || !IsFinite(current.position) || deltaTime < 0f)
                {
                    reason = $"Frame {index} time or pose is invalid.";
                    return false;
                }

                if (deltaTime > 0.001f)
                {
                    float sampledSpeed = Vector3.Distance(previous.position, current.position) / deltaTime;
                    if (sampledSpeed > speedLimit)
                    {
                        reason = $"Frame {index} exceeds the replay speed limit.";
                        return false;
                    }
                }

                previous = current;
            }

            reason = string.Empty;
            return true;
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private static bool IsFinite(Vector3 value)
        {
            return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
        }
    }
}
