#include "Character/AlpineVitalsComponent.h"

#include "GameFramework/Actor.h"
#include "Net/UnrealNetwork.h"

UAlpineVitalsComponent::UAlpineVitalsComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	SetIsReplicatedByDefault(true);
}

void UAlpineVitalsComponent::BeginPlay()
{
	Super::BeginPlay();

	Health = FMath::Clamp(Health, 0.0f, MaxHealth);
	Stamina = FMath::Clamp(Stamina, 0.0f, MaxStamina);
	Mana = bManaEnabled ? FMath::Clamp(Mana, 0.0f, MaxMana) : 0.0f;
	NotifyVitalsChanged();
}

void UAlpineVitalsComponent::TickComponent(
	float DeltaTime,
	ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	const AActor* OwnerActor = GetOwner();
	if ((OwnerActor && !OwnerActor->HasAuthority()) || bStaminaRegenerationPaused)
	{
		return;
	}

	TimeSinceStaminaUse += DeltaTime;
	if (TimeSinceStaminaUse < StaminaRegenerationDelay || Stamina >= MaxStamina)
	{
		return;
	}

	const float PreviousStamina = Stamina;
	Stamina = FMath::Min(MaxStamina, Stamina + StaminaRegenerationPerSecond * DeltaTime);
	if (!FMath::IsNearlyEqual(PreviousStamina, Stamina))
	{
		NotifyVitalsChanged();
	}
}

void UAlpineVitalsComponent::GetLifetimeReplicatedProps(
	TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(UAlpineVitalsComponent, MaxHealth);
	DOREPLIFETIME(UAlpineVitalsComponent, Health);
	DOREPLIFETIME(UAlpineVitalsComponent, MaxStamina);
	DOREPLIFETIME(UAlpineVitalsComponent, Stamina);
	DOREPLIFETIME(UAlpineVitalsComponent, MaxMana);
	DOREPLIFETIME(UAlpineVitalsComponent, Mana);
	DOREPLIFETIME(UAlpineVitalsComponent, bManaEnabled);
}

float UAlpineVitalsComponent::GetHealthRatio() const
{
	return MaxHealth > 0.0f ? Health / MaxHealth : 0.0f;
}

float UAlpineVitalsComponent::GetStaminaRatio() const
{
	return MaxStamina > 0.0f ? Stamina / MaxStamina : 0.0f;
}

float UAlpineVitalsComponent::GetManaRatio() const
{
	return bManaEnabled && MaxMana > 0.0f ? Mana / MaxMana : 0.0f;
}

float UAlpineVitalsComponent::ApplyHealthDamage(float Amount)
{
	const float AppliedAmount = FMath::Min(FMath::Max(Amount, 0.0f), Health);
	if (AppliedAmount <= 0.0f)
	{
		return 0.0f;
	}

	Health -= AppliedAmount;
	NotifyVitalsChanged();
	return AppliedAmount;
}

float UAlpineVitalsComponent::RestoreHealth(float Amount)
{
	const float RestoredAmount =
		FMath::Min(FMath::Max(Amount, 0.0f), MaxHealth - Health);
	if (RestoredAmount <= 0.0f)
	{
		return 0.0f;
	}

	Health += RestoredAmount;
	NotifyVitalsChanged();
	return RestoredAmount;
}

bool UAlpineVitalsComponent::TryConsumeStamina(float Amount)
{
	const float RequestedAmount = FMath::Max(Amount, 0.0f);
	if (RequestedAmount <= 0.0f)
	{
		return true;
	}
	if (Stamina + KINDA_SMALL_NUMBER < RequestedAmount)
	{
		return false;
	}

	Stamina = FMath::Max(0.0f, Stamina - RequestedAmount);
	TimeSinceStaminaUse = 0.0f;
	NotifyVitalsChanged();
	return true;
}

float UAlpineVitalsComponent::ConsumeStamina(float Amount)
{
	const float ConsumedAmount = FMath::Min(FMath::Max(Amount, 0.0f), Stamina);
	if (ConsumedAmount <= 0.0f)
	{
		return 0.0f;
	}

	Stamina -= ConsumedAmount;
	TimeSinceStaminaUse = 0.0f;
	NotifyVitalsChanged();
	return ConsumedAmount;
}

void UAlpineVitalsComponent::SetStaminaRegenerationPaused(bool bPaused)
{
	bStaminaRegenerationPaused = bPaused;
}

void UAlpineVitalsComponent::SetManaEnabled(bool bEnabled)
{
	if (bManaEnabled == bEnabled)
	{
		return;
	}

	bManaEnabled = bEnabled;
	Mana = bManaEnabled ? MaxMana : 0.0f;
	NotifyVitalsChanged();
}

bool UAlpineVitalsComponent::TryConsumeMana(float Amount)
{
	const float RequestedAmount = FMath::Max(Amount, 0.0f);
	if (!bManaEnabled || Mana + KINDA_SMALL_NUMBER < RequestedAmount)
	{
		return false;
	}
	if (RequestedAmount <= 0.0f)
	{
		return true;
	}

	Mana = FMath::Max(0.0f, Mana - RequestedAmount);
	NotifyVitalsChanged();
	return true;
}

void UAlpineVitalsComponent::OnRep_Vitals()
{
	NotifyVitalsChanged();
}

void UAlpineVitalsComponent::NotifyVitalsChanged()
{
	OnVitalsChanged.Broadcast();
}
