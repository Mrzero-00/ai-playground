#include "Combat/AlpineTargetHealthComponent.h"

#include "Net/UnrealNetwork.h"

UAlpineTargetHealthComponent::UAlpineTargetHealthComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SetIsReplicatedByDefault(true);
}

void UAlpineTargetHealthComponent::BeginPlay()
{
	Super::BeginPlay();

	const AActor* OwnerActor = GetOwner();
	if (!OwnerActor || OwnerActor->HasAuthority())
	{
		Health = MaxHealth;
		LastDamage = 0.0f;
		HitCount = 0;
	}
	OnTargetHealthChanged.Broadcast();
}

void UAlpineTargetHealthComponent::GetLifetimeReplicatedProps(
	TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(UAlpineTargetHealthComponent, MaxHealth);
	DOREPLIFETIME(UAlpineTargetHealthComponent, Health);
	DOREPLIFETIME(UAlpineTargetHealthComponent, LastDamage);
	DOREPLIFETIME(UAlpineTargetHealthComponent, HitCount);
}

float UAlpineTargetHealthComponent::GetHealthRatio() const
{
	return MaxHealth > KINDA_SMALL_NUMBER
		? FMath::Clamp(Health / MaxHealth, 0.0f, 1.0f)
		: 0.0f;
}

float UAlpineTargetHealthComponent::ApplyTargetDamage(float DamageAmount)
{
	AActor* OwnerActor = GetOwner();
	if ((OwnerActor && !OwnerActor->HasAuthority()) ||
		DamageAmount <= 0.0f ||
		IsDepleted())
	{
		return 0.0f;
	}

	const float AppliedDamage = FMath::Min(DamageAmount, Health);
	Health = FMath::Max(Health - AppliedDamage, 0.0f);
	LastDamage = AppliedDamage;
	++HitCount;
	OnTargetHealthChanged.Broadcast();
	if (OwnerActor)
	{
		OwnerActor->ForceNetUpdate();
	}
	return AppliedDamage;
}

void UAlpineTargetHealthComponent::ResetHealth()
{
	AActor* OwnerActor = GetOwner();
	if (OwnerActor && !OwnerActor->HasAuthority())
	{
		return;
	}

	Health = MaxHealth;
	LastDamage = 0.0f;
	HitCount = 0;
	OnTargetHealthChanged.Broadcast();
	if (OwnerActor)
	{
		OwnerActor->ForceNetUpdate();
	}
}

void UAlpineTargetHealthComponent::OnRep_Health()
{
	OnTargetHealthChanged.Broadcast();
}
