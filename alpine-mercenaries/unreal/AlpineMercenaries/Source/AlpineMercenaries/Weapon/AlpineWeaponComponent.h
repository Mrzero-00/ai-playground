#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Weapon/AlpineWeaponTypes.h"
#include "AlpineWeaponComponent.generated.h"

class AAlpineWeaponVisualActor;
class UAlpineVitalsComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAlpineWeaponStateChanged);

UCLASS(ClassGroup = (Alpine), BlueprintType, meta = (BlueprintSpawnableComponent))
class ALPINEMERCENARIES_API UAlpineWeaponComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAlpineWeaponComponent();

	virtual void TickComponent(
		float DeltaTime,
		ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;
	virtual void GetLifetimeReplicatedProps(
		TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	EAlpineWeaponType GetEquippedWeaponType() const { return EquippedWeaponType; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	EAlpineCombatRole GetCombatRole() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	EAlpineWeaponActionState GetActionState() const { return ActionState; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	FName GetWeaponDisplayName() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	FName GetRoleName() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	FName GetRoleActionLabel() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	FName GetActionStateLabel() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	bool IsRoleActionActive() const { return bRoleActionActive; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	bool IsGuarding() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	bool IsPrecisionAiming() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	bool IsGreatswordCharged() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	int32 GetLastHitCount() const { return LastHitCount; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	float GetLastActionDamage() const { return LastActionDamage; }

	UFUNCTION(BlueprintCallable, Category = "Alpine|Weapon")
	bool EquipWeapon(EAlpineWeaponType NewWeaponType);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Weapon")
	bool TryUsePrimaryAction();

	UFUNCTION(BlueprintCallable, Category = "Alpine|Weapon")
	bool StartRoleAction();

	UFUNCTION(BlueprintCallable, Category = "Alpine|Weapon")
	void StopRoleAction();

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	bool IsLocationProtectedByGuard(const FVector& TargetLocation) const;

	const FAlpineWeaponDefinition& GetCurrentDefinition() const;

	UPROPERTY(BlueprintAssignable, Category = "Alpine|Weapon")
	FAlpineWeaponStateChanged OnWeaponStateChanged;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY(
		VisibleInstanceOnly,
		ReplicatedUsing = OnRep_EquippedWeapon,
		Category = "Alpine|Weapon")
	EAlpineWeaponType EquippedWeaponType = EAlpineWeaponType::SwordAndShield;

	UPROPERTY(
		VisibleInstanceOnly,
		ReplicatedUsing = OnRep_WeaponState,
		Category = "Alpine|Weapon")
	EAlpineWeaponActionState ActionState = EAlpineWeaponActionState::Ready;

	UPROPERTY(
		VisibleInstanceOnly,
		ReplicatedUsing = OnRep_WeaponState,
		Category = "Alpine|Weapon")
	bool bRoleActionActive = false;

	UPROPERTY(Transient)
	TObjectPtr<AAlpineWeaponVisualActor> MainHandVisual;

	UPROPERTY(Transient)
	TObjectPtr<AAlpineWeaponVisualActor> OffhandVisual;

	UPROPERTY(VisibleInstanceOnly, Category = "Alpine|Weapon")
	int32 LastHitCount = 0;

	UPROPERTY(VisibleInstanceOnly, Category = "Alpine|Weapon")
	float LastActionDamage = 0.0f;

	float NextPrimaryActionTime = 0.0f;
	FTimerHandle ActionResetTimer;

	UFUNCTION()
	void OnRep_EquippedWeapon();

	UFUNCTION()
	void OnRep_WeaponState();

	UFUNCTION(Server, Reliable)
	void ServerEquipWeapon(EAlpineWeaponType NewWeaponType);

	UFUNCTION(Server, Reliable)
	void ServerUsePrimaryAction();

	UFUNCTION(Server, Reliable)
	void ServerSetRoleAction(bool bActive);

	bool ApplyEquippedWeapon(EAlpineWeaponType NewWeaponType);
	bool ExecutePrimaryAction();
	bool ExecuteStartRoleAction();
	void ExecuteStopRoleAction();
	int32 PerformMeleeTrace(float Damage);
	int32 PerformRangedTrace(float Damage);
	void FinishPrimaryAction();
	void SetActionState(EAlpineWeaponActionState NewState);
	void RebuildWeaponVisuals();
	void DestroyWeaponVisuals();
	AAlpineWeaponVisualActor* SpawnWeaponVisual(bool bOffhand);
	UAlpineVitalsComponent* GetOwnerVitals() const;
};
