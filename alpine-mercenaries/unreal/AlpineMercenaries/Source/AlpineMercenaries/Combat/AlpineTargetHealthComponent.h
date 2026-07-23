#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AlpineTargetHealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAlpineTargetHealthChanged);

UCLASS(ClassGroup = (Alpine), BlueprintType, meta = (BlueprintSpawnableComponent))
class ALPINEMERCENARIES_API UAlpineTargetHealthComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAlpineTargetHealthComponent();

	virtual void GetLifetimeReplicatedProps(
		TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UFUNCTION(BlueprintPure, Category = "Alpine|Target")
	float GetMaxHealth() const { return MaxHealth; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Target")
	float GetHealth() const { return Health; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Target")
	float GetHealthRatio() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Target")
	float GetLastDamage() const { return LastDamage; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Target")
	int32 GetHitCount() const { return HitCount; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Target")
	bool IsDepleted() const { return Health <= KINDA_SMALL_NUMBER; }

	UFUNCTION(BlueprintCallable, Category = "Alpine|Target")
	float ApplyTargetDamage(float DamageAmount);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Target")
	void ResetHealth();

	UPROPERTY(BlueprintAssignable, Category = "Alpine|Target")
	FAlpineTargetHealthChanged OnTargetHealthChanged;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY(
		EditDefaultsOnly,
		ReplicatedUsing = OnRep_Health,
		Category = "Alpine|Target",
		meta = (ClampMin = "1.0"))
	float MaxHealth = 300.0f;

	UPROPERTY(
		VisibleInstanceOnly,
		ReplicatedUsing = OnRep_Health,
		Category = "Alpine|Target")
	float Health = 300.0f;

	UPROPERTY(
		VisibleInstanceOnly,
		ReplicatedUsing = OnRep_Health,
		Category = "Alpine|Target")
	float LastDamage = 0.0f;

	UPROPERTY(
		VisibleInstanceOnly,
		ReplicatedUsing = OnRep_Health,
		Category = "Alpine|Target")
	int32 HitCount = 0;

	UFUNCTION()
	void OnRep_Health();
};
