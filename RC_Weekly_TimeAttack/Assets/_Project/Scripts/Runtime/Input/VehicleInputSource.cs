using UnityEngine;

namespace RCWeeklyTimeAttack.Input
{
    public abstract class VehicleInputSource : MonoBehaviour, IVehicleInputSource
    {
        public abstract VehicleInputFrame ReadInput();
        public abstract void ResetInput();
    }
}

