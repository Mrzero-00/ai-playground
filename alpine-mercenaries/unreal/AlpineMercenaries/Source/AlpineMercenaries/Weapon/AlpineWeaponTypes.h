#pragma once

#include "CoreMinimal.h"
#include "AlpineWeaponTypes.generated.h"

UENUM(BlueprintType)
enum class EAlpineWeaponType : uint8
{
	SwordAndShield,
	Bow,
	Greatsword
};

UENUM(BlueprintType)
enum class EAlpineCombatRole : uint8
{
	VanguardTank,
	RearlineDamage,
	VanguardBreaker
};

UENUM(BlueprintType)
enum class EAlpineWeaponActionState : uint8
{
	Ready,
	PrimaryAttack,
	RoleAction,
	SpecialAttack,
	WeaponSpecial
};

UENUM(BlueprintType)
enum class EAlpineSpecialAttackSlot : uint8
{
	None = 0,
	Slot1 = 1,
	Slot2 = 2,
	Slot3 = 3
};

USTRUCT(BlueprintType)
struct FAlpineWeaponDefinition
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	EAlpineWeaponType WeaponType = EAlpineWeaponType::SwordAndShield;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	EAlpineCombatRole CombatRole = EAlpineCombatRole::VanguardTank;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	FName DisplayName = TEXT("Sword & Shield");

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	FName RoleName = TEXT("Vanguard Tank");

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float PrimaryDamage = 24.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float PrimaryRange = 185.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float TraceRadius = 50.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float PrimaryStaminaCost = 8.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float PrimaryCooldown = 0.45f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float RoleStartStaminaCost = 5.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float RoleStaminaPerSecond = 6.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	float RoleDamageMultiplier = 1.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	bool bRanged = false;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon")
	bool bHasOffhandVisual = true;
};

USTRUCT(BlueprintType)
struct FAlpinePrimaryComboStepDefinition
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Combo")
	EAlpineWeaponType WeaponType = EAlpineWeaponType::SwordAndShield;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Combo")
	int32 ComboStep = 1;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Combo")
	FName MotionName = TEXT("Primary Attack");

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Combo")
	float DamageMultiplier = 1.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Combo")
	float Range = 185.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Combo")
	float TraceRadius = 50.0f;
};

USTRUCT(BlueprintType)
struct FAlpineSpecialAttackDefinition
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	EAlpineWeaponType WeaponType = EAlpineWeaponType::SwordAndShield;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	EAlpineSpecialAttackSlot Slot = EAlpineSpecialAttackSlot::Slot1;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	FName DisplayName = TEXT("Special Attack");

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	float DamageMultiplier = 1.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	float Range = 200.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	float TraceRadius = 50.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	float StaminaCost = 12.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	float Cooldown = 1.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Alpine|Weapon|Special Attack")
	bool bRanged = false;
};

ALPINEMERCENARIES_API const FAlpineWeaponDefinition& GetAlpineWeaponDefinition(
	EAlpineWeaponType WeaponType);

ALPINEMERCENARIES_API const FAlpinePrimaryComboStepDefinition*
	FindAlpinePrimaryComboStepDefinition(
		EAlpineWeaponType WeaponType,
		int32 ComboStep);

ALPINEMERCENARIES_API const FAlpineSpecialAttackDefinition*
	FindAlpineSpecialAttackDefinition(
		EAlpineWeaponType WeaponType,
		EAlpineSpecialAttackSlot Slot);

ALPINEMERCENARIES_API float CalculateAlpineWeaponDamage(
	EAlpineWeaponType WeaponType,
	bool bRoleActionActive);

ALPINEMERCENARIES_API float CalculateAlpinePrimaryComboDamage(
	EAlpineWeaponType WeaponType,
	int32 ComboStep,
	bool bRoleActionActive);

ALPINEMERCENARIES_API float CalculateAlpineSpecialAttackDamage(
	EAlpineWeaponType WeaponType,
	EAlpineSpecialAttackSlot Slot,
	bool bRoleActionActive);

ALPINEMERCENARIES_API bool IsLocationProtectedByAlpineGuard(
	const FVector& GuardOrigin,
	const FVector& GuardForward,
	const FVector& TargetLocation,
	float MaximumDistance = 250.0f,
	float HalfAngleDegrees = 60.0f);
