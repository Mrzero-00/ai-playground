using UnrealBuildTool;

public class AlpineMercenariesTarget : TargetRules
{
	public AlpineMercenariesTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("AlpineMercenaries");
	}
}
