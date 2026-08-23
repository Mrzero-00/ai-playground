namespace RCWeeklyTimeAttack.Input
{
    public interface IVehicleInputSource
    {
        VehicleInputFrame ReadInput();
        void ResetInput();
    }
}

