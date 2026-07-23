#include "Weapon/AlpineWeaponTypes.h"

namespace
{
FAlpineWeaponDefinition MakeSwordAndShieldDefinition()
{
	FAlpineWeaponDefinition Definition;
	Definition.WeaponType = EAlpineWeaponType::SwordAndShield;
	Definition.CombatRole = EAlpineCombatRole::VanguardTank;
	Definition.DisplayName = TEXT("Sword & Shield");
	Definition.RoleName = TEXT("Vanguard Tank");
	Definition.PrimaryDamage = 24.0f;
	Definition.PrimaryRange = 185.0f;
	Definition.TraceRadius = 50.0f;
	Definition.PrimaryStaminaCost = 8.0f;
	Definition.PrimaryCooldown = 0.45f;
	Definition.RoleStartStaminaCost = 5.0f;
	Definition.RoleStaminaPerSecond = 6.0f;
	Definition.RoleDamageMultiplier = 1.0f;
	Definition.bRanged = false;
	Definition.bHasOffhandVisual = true;
	return Definition;
}

FAlpineWeaponDefinition MakeBowDefinition()
{
	FAlpineWeaponDefinition Definition;
	Definition.WeaponType = EAlpineWeaponType::Bow;
	Definition.CombatRole = EAlpineCombatRole::RearlineDamage;
	Definition.DisplayName = TEXT("Longbow");
	Definition.RoleName = TEXT("Rearline Precision");
	Definition.PrimaryDamage = 32.0f;
	Definition.PrimaryRange = 5000.0f;
	Definition.TraceRadius = 0.0f;
	Definition.PrimaryStaminaCost = 10.0f;
	Definition.PrimaryCooldown = 0.75f;
	Definition.RoleStartStaminaCost = 3.0f;
	Definition.RoleStaminaPerSecond = 1.0f;
	Definition.RoleDamageMultiplier = 1.25f;
	Definition.bRanged = true;
	Definition.bHasOffhandVisual = false;
	return Definition;
}

FAlpineWeaponDefinition MakeGreatswordDefinition()
{
	FAlpineWeaponDefinition Definition;
	Definition.WeaponType = EAlpineWeaponType::Greatsword;
	Definition.CombatRole = EAlpineCombatRole::VanguardBreaker;
	Definition.DisplayName = TEXT("Greatsword");
	Definition.RoleName = TEXT("Vanguard Breaker");
	Definition.PrimaryDamage = 52.0f;
	Definition.PrimaryRange = 240.0f;
	Definition.TraceRadius = 90.0f;
	Definition.PrimaryStaminaCost = 18.0f;
	Definition.PrimaryCooldown = 1.1f;
	Definition.RoleStartStaminaCost = 7.0f;
	Definition.RoleStaminaPerSecond = 5.0f;
	Definition.RoleDamageMultiplier = 1.5f;
	Definition.bRanged = false;
	Definition.bHasOffhandVisual = false;
	return Definition;
}
}

const FAlpineWeaponDefinition& GetAlpineWeaponDefinition(
	EAlpineWeaponType WeaponType)
{
	static const FAlpineWeaponDefinition SwordAndShield =
		MakeSwordAndShieldDefinition();
	static const FAlpineWeaponDefinition Bow = MakeBowDefinition();
	static const FAlpineWeaponDefinition Greatsword = MakeGreatswordDefinition();

	switch (WeaponType)
	{
	case EAlpineWeaponType::Bow:
		return Bow;
	case EAlpineWeaponType::Greatsword:
		return Greatsword;
	case EAlpineWeaponType::SwordAndShield:
	default:
		return SwordAndShield;
	}
}

float CalculateAlpineWeaponDamage(
	EAlpineWeaponType WeaponType,
	bool bRoleActionActive)
{
	const FAlpineWeaponDefinition& Definition =
		GetAlpineWeaponDefinition(WeaponType);
	const float Multiplier =
		bRoleActionActive ? Definition.RoleDamageMultiplier : 1.0f;
	return Definition.PrimaryDamage * Multiplier;
}

bool IsLocationProtectedByAlpineGuard(
	const FVector& GuardOrigin,
	const FVector& GuardForward,
	const FVector& TargetLocation,
	float MaximumDistance,
	float HalfAngleDegrees)
{
	FVector ToTarget = TargetLocation - GuardOrigin;
	ToTarget.Z = 0.0f;
	const float Distance = ToTarget.Size();
	if (Distance <= KINDA_SMALL_NUMBER ||
		Distance > FMath::Max(MaximumDistance, 0.0f))
	{
		return false;
	}

	FVector Forward = GuardForward;
	Forward.Z = 0.0f;
	if (!Forward.Normalize())
	{
		return false;
	}

	const float ClampedHalfAngle = FMath::Clamp(HalfAngleDegrees, 0.0f, 180.0f);
	const float MinimumDot = FMath::Cos(FMath::DegreesToRadians(ClampedHalfAngle));
	return FVector::DotProduct(Forward, ToTarget / Distance) >= MinimumDot;
}
