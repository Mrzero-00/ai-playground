using System;
using System.Globalization;

namespace RCWeeklyTimeAttack.Race
{
    public static class RaceTimeFormatter
    {
        public static string Format(float seconds)
        {
            if (seconds < 0f || float.IsNaN(seconds) || float.IsInfinity(seconds))
            {
                return "--:--.---";
            }

            int totalMilliseconds = (int)Math.Round(seconds * 1000d, MidpointRounding.AwayFromZero);
            int minutes = totalMilliseconds / 60000;
            int remainingMilliseconds = totalMilliseconds % 60000;
            int wholeSeconds = remainingMilliseconds / 1000;
            int milliseconds = remainingMilliseconds % 1000;
            return string.Format(
                CultureInfo.InvariantCulture,
                "{0:00}:{1:00}.{2:000}",
                minutes,
                wholeSeconds,
                milliseconds);
        }
    }
}
