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

FAlpineSpecialAttackDefinition MakeSpecialAttackDefinition(
	EAlpineWeaponType WeaponType,
	EAlpineSpecialAttackSlot Slot,
	FName DisplayName,
	float DamageMultiplier,
	float Range,
	float TraceRadius,
	float StaminaCost,
	float Cooldown,
	bool bRanged)
{
	FAlpineSpecialAttackDefinition Definition;
	Definition.WeaponType = WeaponType;
	Definition.Slot = Slot;
	Definition.DisplayName = DisplayName;
	Definition.DamageMultiplier = DamageMultiplier;
	Definition.Range = Range;
	Definition.TraceRadius = TraceRadius;
	Definition.StaminaCost = StaminaCost;
	Definition.Cooldown = Cooldown;
	Definition.bRanged = bRanged;
	return Definition;
}

FAlpinePrimaryComboStepDefinition MakePrimaryComboStepDefinition(
	EAlpineWeaponType WeaponType,
	int32 ComboStep,
	FName MotionName,
	float DamageMultiplier,
	float Range,
	float TraceRadius)
{
	FAlpinePrimaryComboStepDefinition Definition;
	Definition.WeaponType = WeaponType;
	Definition.ComboStep = ComboStep;
	Definition.MotionName = MotionName;
	Definition.DamageMultiplier = DamageMultiplier;
	Definition.Range = Range;
	Definition.TraceRadius = TraceRadius;
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

const FAlpinePrimaryComboStepDefinition*
	FindAlpinePrimaryComboStepDefinition(
		EAlpineWeaponType WeaponType,
		int32 ComboStep)
{
	static const FAlpinePrimaryComboStepDefinition SwordShield1 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::SwordAndShield,
			1,
			TEXT("Diagonal Slash"),
			0.95f,
			190.0f,
			52.0f);
	static const FAlpinePrimaryComboStepDefinition SwordShield2 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::SwordAndShield,
			2,
			TEXT("Horizontal Slash"),
			1.05f,
			210.0f,
			82.0f);
	static const FAlpinePrimaryComboStepDefinition SwordShield3 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::SwordAndShield,
			3,
			TEXT("Thrust"),
			1.3f,
			255.0f,
			28.0f);

	static const FAlpinePrimaryComboStepDefinition Bow1 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::Bow,
			1,
			TEXT("Quick Draw"),
			0.9f,
			5000.0f,
			0.0f);
	static const FAlpinePrimaryComboStepDefinition Bow2 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::Bow,
			2,
			TEXT("Driving Shot"),
			1.0f,
			5500.0f,
			0.0f);
	static const FAlpinePrimaryComboStepDefinition Bow3 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::Bow,
			3,
			TEXT("Finisher Shot"),
			1.35f,
			6200.0f,
			0.0f);

	static const FAlpinePrimaryComboStepDefinition Greatsword1 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::Greatsword,
			1,
			TEXT("Falling Slash"),
			0.9f,
			235.0f,
			88.0f);
	static const FAlpinePrimaryComboStepDefinition Greatsword2 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::Greatsword,
			2,
			TEXT("Broad Cleave"),
			1.05f,
			265.0f,
			145.0f);
	static const FAlpinePrimaryComboStepDefinition Greatsword3 =
		MakePrimaryComboStepDefinition(
			EAlpineWeaponType::Greatsword,
			3,
			TEXT("Overhead Breaker"),
			1.45f,
			295.0f,
			105.0f);

	switch (WeaponType)
	{
	case EAlpineWeaponType::SwordAndShield:
		switch (ComboStep)
		{
		case 1:
			return &SwordShield1;
		case 2:
			return &SwordShield2;
		case 3:
			return &SwordShield3;
		default:
			return nullptr;
		}
	case EAlpineWeaponType::Bow:
		switch (ComboStep)
		{
		case 1:
			return &Bow1;
		case 2:
			return &Bow2;
		case 3:
			return &Bow3;
		default:
			return nullptr;
		}
	case EAlpineWeaponType::Greatsword:
		switch (ComboStep)
		{
		case 1:
			return &Greatsword1;
		case 2:
			return &Greatsword2;
		case 3:
			return &Greatsword3;
		default:
			return nullptr;
		}
	default:
		return nullptr;
	}
}

const FAlpineSpecialAttackDefinition* FindAlpineSpecialAttackDefinition(
	EAlpineWeaponType WeaponType,
	EAlpineSpecialAttackSlot Slot)
{
	static const FAlpineSpecialAttackDefinition SwordShield1 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::SwordAndShield,
			EAlpineSpecialAttackSlot::Slot1,
			TEXT("Shield Bash"),
			0.9f,
			145.0f,
			75.0f,
			12.0f,
			0.9f,
			false);
	static const FAlpineSpecialAttackDefinition SwordShield2 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::SwordAndShield,
			EAlpineSpecialAttackSlot::Slot2,
			TEXT("Guard Sweep"),
			1.35f,
			215.0f,
			105.0f,
			18.0f,
			1.6f,
			false);
	static const FAlpineSpecialAttackDefinition SwordShield3 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::SwordAndShield,
			EAlpineSpecialAttackSlot::Slot3,
			TEXT("Vanguard Break"),
			1.9f,
			245.0f,
			90.0f,
			26.0f,
			3.2f,
			false);

	static const FAlpineSpecialAttackDefinition Bow1 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::Bow,
			EAlpineSpecialAttackSlot::Slot1,
			TEXT("Quick Shot"),
			0.85f,
			5000.0f,
			0.0f,
			9.0f,
			0.45f,
			true);
	static const FAlpineSpecialAttackDefinition Bow2 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::Bow,
			EAlpineSpecialAttackSlot::Slot2,
			TEXT("Piercing Shot"),
			1.55f,
			6000.0f,
			0.0f,
			18.0f,
			1.7f,
			true);
	static const FAlpineSpecialAttackDefinition Bow3 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::Bow,
			EAlpineSpecialAttackSlot::Slot3,
			TEXT("Deadeye Shot"),
			2.25f,
			7000.0f,
			0.0f,
			27.0f,
			3.4f,
			true);

	static const FAlpineSpecialAttackDefinition Greatsword1 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::Greatsword,
			EAlpineSpecialAttackSlot::Slot1,
			TEXT("Rising Slash"),
			1.05f,
			225.0f,
			85.0f,
			16.0f,
			1.0f,
			false);
	static const FAlpineSpecialAttackDefinition Greatsword2 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::Greatsword,
			EAlpineSpecialAttackSlot::Slot2,
			TEXT("Wide Cleave"),
			1.45f,
			250.0f,
			145.0f,
			24.0f,
			1.9f,
			false);
	static const FAlpineSpecialAttackDefinition Greatsword3 =
		MakeSpecialAttackDefinition(
			EAlpineWeaponType::Greatsword,
			EAlpineSpecialAttackSlot::Slot3,
			TEXT("Earth Splitter"),
			2.1f,
			330.0f,
			110.0f,
			34.0f,
			3.8f,
			false);

	switch (WeaponType)
	{
	case EAlpineWeaponType::SwordAndShield:
		switch (Slot)
		{
		case EAlpineSpecialAttackSlot::Slot1:
			return &SwordShield1;
		case EAlpineSpecialAttackSlot::Slot2:
			return &SwordShield2;
		case EAlpineSpecialAttackSlot::Slot3:
			return &SwordShield3;
		default:
			return nullptr;
		}
	case EAlpineWeaponType::Bow:
		switch (Slot)
		{
		case EAlpineSpecialAttackSlot::Slot1:
			return &Bow1;
		case EAlpineSpecialAttackSlot::Slot2:
			return &Bow2;
		case EAlpineSpecialAttackSlot::Slot3:
			return &Bow3;
		default:
			return nullptr;
		}
	case EAlpineWeaponType::Greatsword:
		switch (Slot)
		{
		case EAlpineSpecialAttackSlot::Slot1:
			return &Greatsword1;
		case EAlpineSpecialAttackSlot::Slot2:
			return &Greatsword2;
		case EAlpineSpecialAttackSlot::Slot3:
			return &Greatsword3;
		default:
			return nullptr;
		}
	default:
		return nullptr;
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

float CalculateAlpinePrimaryComboDamage(
	EAlpineWeaponType WeaponType,
	int32 ComboStep,
	bool bRoleActionActive)
{
	const FAlpinePrimaryComboStepDefinition* Combo =
		FindAlpinePrimaryComboStepDefinition(WeaponType, ComboStep);
	if (!Combo)
	{
		return 0.0f;
	}

	return CalculateAlpineWeaponDamage(
		WeaponType,
		bRoleActionActive) * Combo->DamageMultiplier;
}

float CalculateAlpineSpecialAttackDamage(
	EAlpineWeaponType WeaponType,
	EAlpineSpecialAttackSlot Slot,
	bool bRoleActionActive)
{
	const FAlpineSpecialAttackDefinition* SpecialAttack =
		FindAlpineSpecialAttackDefinition(WeaponType, Slot);
	if (!SpecialAttack)
	{
		return 0.0f;
	}

	const FAlpineWeaponDefinition& Weapon =
		GetAlpineWeaponDefinition(WeaponType);
	const float RoleMultiplier =
		bRoleActionActive ? Weapon.RoleDamageMultiplier : 1.0f;
	return Weapon.PrimaryDamage *
		SpecialAttack->DamageMultiplier *
		RoleMultiplier;
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
