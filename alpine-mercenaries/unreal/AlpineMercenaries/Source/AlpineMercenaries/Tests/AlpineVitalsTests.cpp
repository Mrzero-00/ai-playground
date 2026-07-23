#if WITH_DEV_AUTOMATION_TESTS

#include "Character/AlpineVitalsComponent.h"

#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FAlpineVitalsResourceTest,
	"AlpineMercenaries.Vitals.Resources",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FAlpineVitalsResourceTest::RunTest(const FString& Parameters)
{
	UAlpineVitalsComponent* Vitals = NewObject<UAlpineVitalsComponent>();
	TestNotNull(TEXT("Vitals instance"), Vitals);
	if (!Vitals)
	{
		return false;
	}

	TestEqual(TEXT("Initial health"), Vitals->GetHealth(), 100.0f);
	TestEqual(TEXT("Initial stamina"), Vitals->GetStamina(), 100.0f);
	TestFalse(TEXT("Mana starts disabled"), Vitals->IsManaEnabled());
	TestEqual(TEXT("Disabled mana is empty"), Vitals->GetMana(), 0.0f);

	TestTrue(TEXT("Affordable stamina action succeeds"), Vitals->TryConsumeStamina(25.0f));
	TestEqual(TEXT("Stamina is consumed"), Vitals->GetStamina(), 75.0f);
	TestFalse(TEXT("Unaffordable stamina action is rejected"), Vitals->TryConsumeStamina(80.0f));
	TestEqual(TEXT("Rejected action does not consume stamina"), Vitals->GetStamina(), 75.0f);

	TestEqual(TEXT("Health damage applied"), Vitals->ApplyHealthDamage(30.0f), 30.0f);
	TestEqual(TEXT("Health after damage"), Vitals->GetHealth(), 70.0f);
	TestEqual(TEXT("Health restored"), Vitals->RestoreHealth(15.0f), 15.0f);
	TestEqual(TEXT("Health after restore"), Vitals->GetHealth(), 85.0f);

	Vitals->SetManaEnabled(true);
	TestTrue(TEXT("Magic weapon enables mana"), Vitals->IsManaEnabled());
	TestEqual(TEXT("Mana fills when enabled"), Vitals->GetMana(), 100.0f);
	TestTrue(TEXT("Affordable mana action succeeds"), Vitals->TryConsumeMana(35.0f));
	TestEqual(TEXT("Mana is consumed"), Vitals->GetMana(), 65.0f);

	Vitals->SetManaEnabled(false);
	TestFalse(TEXT("Removing magic weapon disables mana"), Vitals->IsManaEnabled());
	TestEqual(TEXT("Disabled mana returns to zero"), Vitals->GetMana(), 0.0f);
	TestFalse(TEXT("Mana cannot be spent while disabled"), Vitals->TryConsumeMana(1.0f));

	return true;
}

#endif
