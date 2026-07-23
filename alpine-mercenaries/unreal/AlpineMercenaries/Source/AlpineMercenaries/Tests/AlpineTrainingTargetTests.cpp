#if WITH_DEV_AUTOMATION_TESTS

#include "Combat/AlpineTargetHealthComponent.h"
#include "Combat/AlpineTrainingTarget.h"
#include "Game/AlpineGameMode.h"

#include "Components/CapsuleComponent.h"
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FAlpineTrainingTargetTest,
	"AlpineMercenaries.Combat.TrainingTarget",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FAlpineTrainingTargetTest::RunTest(const FString& Parameters)
{
	UAlpineTargetHealthComponent* Health =
		NewObject<UAlpineTargetHealthComponent>();
	TestNotNull(TEXT("Training target health component instance"), Health);
	if (!Health)
	{
		return false;
	}

	TestEqual(TEXT("Training target starts at 300 HP"), Health->GetHealth(), 300.0f);
	TestEqual(
		TEXT("Training target maximum HP is 300"),
		Health->GetMaxHealth(),
		300.0f);
	TestEqual(TEXT("Training target starts with no hits"), Health->GetHitCount(), 0);

	TestEqual(
		TEXT("Positive damage is applied"),
		Health->ApplyTargetDamage(75.0f),
		75.0f);
	TestEqual(TEXT("Damage reduces current HP"), Health->GetHealth(), 225.0f);
	TestEqual(TEXT("Last damage is recorded"), Health->GetLastDamage(), 75.0f);
	TestEqual(TEXT("Hit count increments"), Health->GetHitCount(), 1);

	TestEqual(
		TEXT("Damage is clamped to remaining HP"),
		Health->ApplyTargetDamage(500.0f),
		225.0f);
	TestEqual(TEXT("Training target reaches zero HP"), Health->GetHealth(), 0.0f);
	TestTrue(TEXT("Zero HP reports depleted"), Health->IsDepleted());
	TestEqual(TEXT("Lethal hit increments hit count"), Health->GetHitCount(), 2);
	TestEqual(
		TEXT("Further damage at zero HP is ignored"),
		Health->ApplyTargetDamage(10.0f),
		0.0f);
	TestEqual(TEXT("Ignored damage does not add a hit"), Health->GetHitCount(), 2);

	Health->ResetHealth();
	TestEqual(TEXT("Reset restores maximum HP"), Health->GetHealth(), 300.0f);
	TestEqual(TEXT("Reset clears last damage"), Health->GetLastDamage(), 0.0f);
	TestEqual(TEXT("Reset clears hit count"), Health->GetHitCount(), 0);
	TestEqual(
		TEXT("Negative damage is ignored"),
		Health->ApplyTargetDamage(-20.0f),
		0.0f);

	const AAlpineTrainingTarget* Target =
		GetDefault<AAlpineTrainingTarget>();
	TestNotNull(TEXT("Training target class default"), Target);
	if (Target)
	{
		TestNotNull(
			TEXT("Training target owns its health component"),
			Target->GetHealthComponent());
		TestEqual(
			TEXT("Training target resets four seconds after depletion"),
			Target->GetResetDelay(),
			4.0f);
		TestEqual(
			TEXT("Training target collision height supports melee and arrows"),
			Target->GetCollisionHalfHeight(),
			110.0f);
		TestFalse(
			TEXT("Training target has no movement tick"),
			Target->IsActorTickEnabled());
		TestTrue(
			TEXT("Training target accepts actor damage"),
			Target->CanBeDamaged());
		const UCapsuleComponent* Collision =
			Target->GetCollisionComponent();
		TestNotNull(TEXT("Training target owns collision"), Collision);
		if (Collision)
		{
			TestEqual(
				TEXT("Melee pawn sweeps are blocked by the target"),
				Collision->GetCollisionResponseToChannel(ECC_Pawn),
				ECR_Block);
			TestEqual(
				TEXT("Bow visibility traces are blocked by the target"),
				Collision->GetCollisionResponseToChannel(ECC_Visibility),
				ECR_Block);
		}
	}

	const AAlpineGameMode* GameMode = GetDefault<AAlpineGameMode>();
	TestNotNull(TEXT("Alpine game mode class default"), GameMode);
	if (GameMode)
	{
		TestTrue(
			TEXT("The development map automatically spawns a training target"),
			GameMode->ShouldSpawnTrainingTarget());
	}

	return true;
}

#endif
