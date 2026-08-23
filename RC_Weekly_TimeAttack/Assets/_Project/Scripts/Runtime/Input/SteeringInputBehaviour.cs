using UnityEngine;

namespace RCWeeklyTimeAttack.Input
{
    public abstract class SteeringInputBehaviour : MonoBehaviour, ISteeringInput
    {
        public abstract float Value { get; }
        public abstract void ResetInput();
    }
}

