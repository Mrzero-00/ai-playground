#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AlpineVitalsComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAlpineVitalsChanged);

UCLASS(ClassGroup = (Alpine), BlueprintType, Blueprintable, meta = (BlueprintSpawnableComponent))
class ALPINEMERCENARIES_API UAlpineVitalsComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAlpineVitalsComponent();

	virtual void TickComponent(
		float DeltaTime,
		ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;
	virtual void GetLifetimeReplicatedProps(
		TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetHealth() const { return Health; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetMaxHealth() const { return MaxHealth; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetHealthRatio() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetStamina() const { return Stamina; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetMaxStamina() const { return MaxStamina; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetStaminaRatio() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	bool IsManaEnabled() const { return bManaEnabled; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetMana() const { return Mana; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetMaxMana() const { return MaxMana; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	float GetManaRatio() const;

	UFUNCTION(BlueprintCallable, Category = "Alpine|Vitals")
	float ApplyHealthDamage(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Vitals")
	float RestoreHealth(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Vitals")
	bool TryConsumeStamina(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Vitals")
	float ConsumeStamina(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Vitals")
	void SetStaminaRegenerationPaused(bool bPaused);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Vitals")
	void SetManaEnabled(bool bEnabled);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Vitals")
	bool TryConsumeMana(float Amount);

	UPROPERTY(BlueprintAssignable, Category = "Alpine|Vitals")
	FAlpineVitalsChanged OnVitalsChanged;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY(EditDefaultsOnly, ReplicatedUsing = OnRep_Vitals, Category = "Alpine|Vitals", meta = (ClampMin = "1.0"))
	float MaxHealth = 100.0f;

	UPROPERTY(VisibleInstanceOnly, ReplicatedUsing = OnRep_Vitals, Category = "Alpine|Vitals")
	float Health = 100.0f;

	UPROPERTY(EditDefaultsOnly, ReplicatedUsing = OnRep_Vitals, Category = "Alpine|Vitals", meta = (ClampMin = "1.0"))
	float MaxStamina = 100.0f;

	UPROPERTY(VisibleInstanceOnly, ReplicatedUsing = OnRep_Vitals, Category = "Alpine|Vitals")
	float Stamina = 100.0f;

	UPROPERTY(EditDefaultsOnly, ReplicatedUsing = OnRep_Vitals, Category = "Alpine|Vitals", meta = (ClampMin = "1.0"))
	float MaxMana = 100.0f;

	UPROPERTY(VisibleInstanceOnly, ReplicatedUsing = OnRep_Vitals, Category = "Alpine|Vitals")
	float Mana = 0.0f;

	UPROPERTY(VisibleInstanceOnly, ReplicatedUsing = OnRep_Vitals, Category = "Alpine|Vitals")
	bool bManaEnabled = false;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float StaminaRegenerationPerSecond = 14.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float StaminaRegenerationDelay = 1.25f;

	float TimeSinceStaminaUse = 10.0f;
	bool bStaminaRegenerationPaused = false;

	UFUNCTION()
	void OnRep_Vitals();

	void NotifyVitalsChanged();
};
