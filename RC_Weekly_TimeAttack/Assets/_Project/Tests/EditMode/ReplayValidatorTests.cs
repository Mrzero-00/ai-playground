using System.Collections.Generic;
using NUnit.Framework;
using RCWeeklyTimeAttack.Replay;
using UnityEngine;

namespace RCWeeklyTimeAttack.Tests
{
    public sealed class ReplayValidatorTests
    {
        [Test]
        public void PlausibleFrames_AreAccepted()
        {
            ReplayData data = new("track", 1f, new List<ReplayFrame>
            {
                new(0f, Vector3.zero, Quaternion.identity, 0f, 1f, 0f),
                new(1f, new Vector3(10f, 0f, 0f), Quaternion.identity, 0f, 1f, 0f)
            });

            Assert.That(ReplayValidator.IsPlausible(data, 10f, out string reason), Is.True, reason);
        }

        [Test]
        public void TeleportingFrame_IsRejected()
        {
            ReplayData data = new("track", 1f, new List<ReplayFrame>
            {
                new(0f, Vector3.zero, Quaternion.identity, 0f, 1f, 0f),
                new(0.1f, new Vector3(100f, 0f, 0f), Quaternion.identity, 0f, 1f, 0f)
            });

            Assert.That(ReplayValidator.IsPlausible(data, 10f, out _), Is.False);
        }
    }
}
