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
	RoleAction
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

ALPINEMERCENARIES_API const FAlpineWeaponDefinition& GetAlpineWeaponDefinition(
	EAlpineWeaponType WeaponType);

ALPINEMERCENARIES_API float CalculateAlpineWeaponDamage(
	EAlpineWeaponType WeaponType,
	bool bRoleActionActive);

ALPINEMERCENARIES_API bool IsLocationProtectedByAlpineGuard(
	const FVector& GuardOrigin,
	const FVector& GuardForward,
	const FVector& TargetLocation,
	float MaximumDistance = 250.0f,
	float HalfAngleDegrees = 60.0f);
