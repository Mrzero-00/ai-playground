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
	TestTrue(
		TEXT("Bow can be equipped"),
		WeaponComponent->EquipWeapon(EAlpineWeaponType::Bow));
	TestEqual(
		TEXT("Bow becomes the equipped weapon"),
		WeaponComponent->GetEquippedWeaponType(),
		EAlpineWeaponType::Bow);
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
	TestTrue(
		TEXT("Aimed bow shot can execute"),
		WeaponComponent->TryUsePrimaryAction());
	TestEqual(
		TEXT("Aimed bow shot records boosted damage"),
		WeaponComponent->GetLastActionDamage(),
		40.0f);

	TestTrue(
		TEXT("Greatsword can be equipped"),
		WeaponComponent->EquipWeapon(EAlpineWeaponType::Greatsword));
	TestTrue(
		TEXT("Greatsword power charge can start"),
		WeaponComponent->StartRoleAction());
	TestTrue(
		TEXT("Greatsword enters charged state"),
		WeaponComponent->IsGreatswordCharged());
	TestTrue(
		TEXT("Charged greatsword attack can execute"),
		WeaponComponent->TryUsePrimaryAction());
	TestEqual(
		TEXT("Charged greatsword records boosted damage"),
		WeaponComponent->GetLastActionDamage(),
		78.0f);
	TestFalse(
		TEXT("Greatsword charge is consumed by the attack"),
		WeaponComponent->IsGreatswordCharged());

	const AAlpineMercenaryCharacter* Character =
		GetDefault<AAlpineMercenaryCharacter>();
	TestNotNull(
		TEXT("Alpine character owns the weapon component"),
		Character->GetWeaponComponent());

	return true;
}

#endif
