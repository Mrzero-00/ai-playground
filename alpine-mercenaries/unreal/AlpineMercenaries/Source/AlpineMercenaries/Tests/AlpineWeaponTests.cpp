#if WITH_DEV_AUTOMATION_TESTS

#include "Character/AlpineMercenaryCharacter.h"
#include "Weapon/AlpineWeaponComponent.h"
#include "Weapon/AlpineWeaponTypes.h"

#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FAlpineWeaponFoundationTest,
	"AlpineMercenaries.Weapons.Foundation",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FAlpineWeaponFoundationTest::RunTest(const FString& Parameters)
{
	const FAlpineWeaponDefinition& SwordAndShield =
		GetAlpineWeaponDefinition(EAlpineWeaponType::SwordAndShield);
	const FAlpineWeaponDefinition& Bow =
		GetAlpineWeaponDefinition(EAlpineWeaponType::Bow);
	const FAlpineWeaponDefinition& Greatsword =
		GetAlpineWeaponDefinition(EAlpineWeaponType::Greatsword);

	TestEqual(
		TEXT("Sword and shield is the vanguard tank weapon"),
		SwordAndShield.CombatRole,
		EAlpineCombatRole::VanguardTank);
	TestTrue(
		TEXT("Sword and shield carries an offhand shield"),
		SwordAndShield.bHasOffhandVisual);
	TestEqual(
		TEXT("Bow is the rearline damage weapon"),
		Bow.CombatRole,
		EAlpineCombatRole::RearlineDamage);
	TestTrue(TEXT("Bow uses a ranged trace"), Bow.bRanged);
	TestEqual(
		TEXT("Greatsword is the vanguard breaker weapon"),
		Greatsword.CombatRole,
		EAlpineCombatRole::VanguardBreaker);
	TestTrue(
		TEXT("Greatsword has the widest melee trace"),
		Greatsword.TraceRadius > SwordAndShield.TraceRadius);

	for (EAlpineWeaponType WeaponType : {
			EAlpineWeaponType::SwordAndShield,
			EAlpineWeaponType::Bow,
			EAlpineWeaponType::Greatsword})
	{
		for (int32 ComboStep = 1; ComboStep <= 3; ++ComboStep)
		{
			const FAlpinePrimaryComboStepDefinition* Combo =
				FindAlpinePrimaryComboStepDefinition(
					WeaponType,
					ComboStep);
			TestNotNull(
				*FString::Printf(
					TEXT("Weapon %d has primary combo step %d"),
					static_cast<int32>(WeaponType),
					ComboStep),
				Combo);
			if (Combo)
			{
				TestTrue(
					TEXT("Primary combo has a positive damage multiplier"),
					Combo->DamageMultiplier > 0.0f);
				TestTrue(
					TEXT("Primary combo has positive range"),
					Combo->Range > 0.0f);
			}
		}

		for (int32 SlotNumber = 1; SlotNumber <= 3; ++SlotNumber)
		{
			const FAlpineSpecialAttackDefinition* SpecialAttack =
				FindAlpineSpecialAttackDefinition(
					WeaponType,
					static_cast<EAlpineSpecialAttackSlot>(SlotNumber));
			TestNotNull(
				*FString::Printf(
					TEXT("Weapon %d has skill slot %d"),
					static_cast<int32>(WeaponType),
					SlotNumber),
				SpecialAttack);
			if (SpecialAttack)
			{
				TestTrue(
					TEXT("Skill slot consumes stamina"),
					SpecialAttack->StaminaCost > 0.0f);
				TestTrue(
					TEXT("Skill slot has a cooldown"),
					SpecialAttack->Cooldown > 0.0f);
			}
		}
	}

	TestNull(
		TEXT("Primary combo rejects step zero"),
		FindAlpinePrimaryComboStepDefinition(
			EAlpineWeaponType::SwordAndShield,
			0));
	TestNull(
		TEXT("Skill slots reject unassigned values"),
		FindAlpineSpecialAttackDefinition(
			EAlpineWeaponType::Bow,
			EAlpineSpecialAttackSlot::None));

	const FAlpinePrimaryComboStepDefinition* SwordCombo1 =
		FindAlpinePrimaryComboStepDefinition(
			EAlpineWeaponType::SwordAndShield,
			1);
	const FAlpinePrimaryComboStepDefinition* SwordCombo2 =
		FindAlpinePrimaryComboStepDefinition(
			EAlpineWeaponType::SwordAndShield,
			2);
	const FAlpinePrimaryComboStepDefinition* SwordCombo3 =
		FindAlpinePrimaryComboStepDefinition(
			EAlpineWeaponType::SwordAndShield,
			3);
	TestEqual(
		TEXT("Sword combo one is the requested diagonal slash"),
		SwordCombo1 ? SwordCombo1->MotionName : NAME_None,
		FName(TEXT("Diagonal Slash")));
	TestEqual(
		TEXT("Sword combo two is the requested horizontal slash"),
		SwordCombo2 ? SwordCombo2->MotionName : NAME_None,
		FName(TEXT("Horizontal Slash")));
	TestEqual(
		TEXT("Sword combo three is the requested thrust"),
		SwordCombo3 ? SwordCombo3->MotionName : NAME_None,
		FName(TEXT("Thrust")));
	TestTrue(
		TEXT("Sword thrust is narrower than the two slashes"),
		SwordCombo3 && SwordCombo1 && SwordCombo2 &&
			SwordCombo3->TraceRadius < SwordCombo1->TraceRadius &&
			SwordCombo3->TraceRadius < SwordCombo2->TraceRadius);

	TestEqual(
		TEXT("Precision aim increases bow damage"),
		CalculateAlpineWeaponDamage(EAlpineWeaponType::Bow, true),
		40.0f);
	TestEqual(
		TEXT("Power charge increases greatsword damage"),
		CalculateAlpineWeaponDamage(EAlpineWeaponType::Greatsword, true),
		78.0f);
	TestEqual(
		TEXT("Guard does not add sword damage"),
		CalculateAlpineWeaponDamage(EAlpineWeaponType::SwordAndShield, true),
		SwordAndShield.PrimaryDamage);

	TestTrue(
		TEXT("Guard protects a target directly ahead"),
		IsLocationProtectedByAlpineGuard(
			FVector::ZeroVector,
			FVector::ForwardVector,
			FVector(150.0f, 0.0f, 0.0f)));
	TestFalse(
		TEXT("Guard does not protect a target behind"),
		IsLocationProtectedByAlpineGuard(
			FVector::ZeroVector,
			FVector::ForwardVector,
			FVector(-100.0f, 0.0f, 0.0f)));
	TestFalse(
		TEXT("Guard does not protect a target outside its distance"),
		IsLocationProtectedByAlpineGuard(
			FVector::ZeroVector,
			FVector::ForwardVector,
			FVector(300.0f, 0.0f, 0.0f)));

	UAlpineWeaponComponent* WeaponComponent =
		NewObject<UAlpineWeaponComponent>();
	TestNotNull(TEXT("Weapon component instance"), WeaponComponent);
	if (!WeaponComponent)
	{
		return false;
	}

	TestEqual(
		TEXT("Characters start with sword and shield"),
		WeaponComponent->GetEquippedWeaponType(),
		EAlpineWeaponType::SwordAndShield);
	for (int32 ExpectedStep = 1; ExpectedStep <= 3; ++ExpectedStep)
	{
		TestEqual(
			TEXT("The next combo step is exposed before attacking"),
			WeaponComponent->GetNextPrimaryComboStep(),
			ExpectedStep);
		TestTrue(
			TEXT("Sword primary combo step can execute"),
			WeaponComponent->TryUsePrimaryAction());
		TestEqual(
			TEXT("Primary combo records the executed step"),
			WeaponComponent->GetLastPrimaryComboStep(),
			ExpectedStep);
	}
	TestEqual(
		TEXT("The three-hit combo wraps back to step one"),
		WeaponComponent->GetNextPrimaryComboStep(),
		1);
	TestEqual(
		TEXT("The combo resets after the requested inactivity window"),
		WeaponComponent->GetPrimaryComboResetDelay(),
		1.25f);
	TestTrue(
		TEXT("Sword and shield right mouse guard can start"),
		WeaponComponent->StartRoleAction());
	TestTrue(
		TEXT("Sword and shield enters guard"),
		WeaponComponent->IsGuarding());
	TestTrue(
		TEXT("Releasing right mouse ends sword and shield guard"),
		WeaponComponent->ReleaseRoleAction());
	TestFalse(
		TEXT("Sword and shield guard is released"),
		WeaponComponent->IsGuarding());

	TestTrue(
		TEXT("Bow can be equipped"),
		WeaponComponent->EquipWeapon(EAlpineWeaponType::Bow));
	TestEqual(
		TEXT("Bow becomes the equipped weapon"),
		WeaponComponent->GetEquippedWeaponType(),
		EAlpineWeaponType::Bow);
	TestEqual(
		TEXT("Changing the development weapon resets the combo"),
		WeaponComponent->GetNextPrimaryComboStep(),
		1);
	TestFalse(
		TEXT("Unsupported weapon values are rejected"),
		WeaponComponent->EquipWeapon(static_cast<EAlpineWeaponType>(255)));
	TestEqual(
		TEXT("Rejected weapon does not change the loadout"),
		WeaponComponent->GetEquippedWeaponType(),
		EAlpineWeaponType::Bow);
	TestTrue(
		TEXT("Bow precision aim can start"),
		WeaponComponent->StartRoleAction());
	TestTrue(
		TEXT("Bow enters precision aim"),
		WeaponComponent->IsPrecisionAiming());
	TestFalse(
		TEXT("Left mouse combo is blocked while precision shot is held"),
		WeaponComponent->TryUsePrimaryAction());
	TestTrue(
		TEXT("Releasing right mouse fires the focused bow shot"),
		WeaponComponent->ReleaseRoleAction());
	TestEqual(
		TEXT("Focused bow shot records boosted damage"),
		WeaponComponent->GetLastActionDamage(),
		CalculateAlpineWeaponDamage(EAlpineWeaponType::Bow, true));
	TestEqual(
		TEXT("Right mouse bow special does not advance the left mouse combo"),
		WeaponComponent->GetNextPrimaryComboStep(),
		1);
	TestTrue(
		TEXT("Bow skill slot one can execute"),
		WeaponComponent->TryUseSpecialAttack(1));
	TestEqual(
		TEXT("Bow skill records its slot"),
		WeaponComponent->GetLastSpecialAttackSlot(),
		EAlpineSpecialAttackSlot::Slot1);
	TestEqual(
		TEXT("Bow skill uses its normal slot damage after aim is released"),
		WeaponComponent->GetLastActionDamage(),
		CalculateAlpineSpecialAttackDamage(
			EAlpineWeaponType::Bow,
			EAlpineSpecialAttackSlot::Slot1,
			false));
	TestFalse(
		TEXT("Skill slot zero is rejected"),
		WeaponComponent->TryUseSpecialAttack(0));
	TestFalse(
		TEXT("Skill slot four is rejected"),
		WeaponComponent->TryUseSpecialAttack(4));

	TestTrue(
		TEXT("Greatsword can be equipped"),
		WeaponComponent->EquipWeapon(EAlpineWeaponType::Greatsword));
	TestTrue(
		TEXT("Greatsword power charge can start"),
		WeaponComponent->StartRoleAction());
	TestTrue(
		TEXT("Greatsword enters charged state"),
		WeaponComponent->IsGreatswordCharged());
	TestFalse(
		TEXT("Left mouse combo is blocked while charged slash is held"),
		WeaponComponent->TryUsePrimaryAction());
	TestTrue(
		TEXT("Releasing right mouse executes the charged slash"),
		WeaponComponent->ReleaseRoleAction());
	TestEqual(
		TEXT("Charged greatsword records boosted damage"),
		WeaponComponent->GetLastActionDamage(),
		CalculateAlpineWeaponDamage(
			EAlpineWeaponType::Greatsword,
			true));
	TestFalse(
		TEXT("Greatsword charge is consumed by the attack"),
		WeaponComponent->IsGreatswordCharged());
	TestEqual(
		TEXT("Right mouse charged slash does not advance the left mouse combo"),
		WeaponComponent->GetNextPrimaryComboStep(),
		1);

	for (int32 SlotNumber = 1; SlotNumber <= 3; ++SlotNumber)
	{
		TestTrue(
			*FString::Printf(
				TEXT("Greatsword skill slot %d can execute"),
				SlotNumber),
			WeaponComponent->TryUseSpecialAttack(SlotNumber));
		TestEqual(
			TEXT("The latest greatsword skill slot is recorded"),
			WeaponComponent->GetLastSpecialAttackSlot(),
			static_cast<EAlpineSpecialAttackSlot>(SlotNumber));
	}

	const AAlpineMercenaryCharacter* Character =
		GetDefault<AAlpineMercenaryCharacter>();
	TestNotNull(
		TEXT("Alpine character owns the weapon component"),
		Character->GetWeaponComponent());

	return true;
}

#endif
