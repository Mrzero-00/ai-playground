using UnrealBuildTool;

public class AlpineMercenaries : ModuleRules
{
	public AlpineMercenaries(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput"
		});

		PublicIncludePaths.Add(ModuleDirectory);
	}
}
