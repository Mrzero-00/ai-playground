#include "Weapon/AlpineWeaponComponent.h"

#include "Character/AlpineMercenaryCharacter.h"
#include "Character/AlpineVitalsComponent.h"
#include "Engine/DamageEvents.h"
#include "Engine/World.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Net/UnrealNetwork.h"
#include "TimerManager.h"
#include "Weapon/AlpineWeaponVisualActor.h"

UAlpineWeaponComponent::UAlpineWeaponComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	SetIsReplicatedByDefault(true);
}

void UAlpineWeaponComponent::BeginPlay()
{
	Super::BeginPlay();

	RebuildWeaponVisuals();
	OnWeaponStateChanged.Broadcast();
}

void UAlpineWeaponComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	DestroyWeaponVisuals();
	Super::EndPlay(EndPlayReason);
}

void UAlpineWeaponComponent::TickComponent(
	float DeltaTime,
	ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	const AActor* OwnerActor = GetOwner();
	if (!bRoleActionActive || (OwnerActor && !OwnerActor->HasAuthority()))
	{
		return;
	}

	UAlpineVitalsComponent* Vitals = GetOwnerVitals();
	const float StaminaCost =
		GetCurrentDefinition().RoleStaminaPerSecond * FMath::Max(DeltaTime, 0.0f);
	if (Vitals && !Vitals->TryConsumeStamina(StaminaCost))
	{
		ExecuteStopRoleAction();
	}
}

void UAlpineWeaponComponent::GetLifetimeReplicatedProps(
	TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(UAlpineWeaponComponent, EquippedWeaponType);
	DOREPLIFETIME(UAlpineWeaponComponent, ActionState);
	DOREPLIFETIME(UAlpineWeaponComponent, bRoleActionActive);
}

EAlpineCombatRole UAlpineWeaponComponent::GetCombatRole() const
{
	return GetCurrentDefinition().CombatRole;
}

FName UAlpineWeaponComponent::GetWeaponDisplayName() const
{
	return GetCurrentDefinition().DisplayName;
}

FName UAlpineWeaponComponent::GetRoleName() const
{
	return GetCurrentDefinition().RoleName;
}

FName UAlpineWeaponComponent::GetRoleActionLabel() const
{
	switch (EquippedWeaponType)
	{
	case EAlpineWeaponType::Bow:
		return TEXT("PRECISION AIM");
	case EAlpineWeaponType::Greatsword:
		return TEXT("POWER CHARGE");
	case EAlpineWeaponType::SwordAndShield:
	default:
		return TEXT("GUARD");
	}
}

FName UAlpineWeaponComponent::GetActionStateLabel() const
{
	if (ActionState == EAlpineWeaponActionState::PrimaryAttack)
	{
		return TEXT("ATTACK");
	}
	if (bRoleActionActive)
	{
		return GetRoleActionLabel();
	}
	return TEXT("READY");
}

bool UAlpineWeaponComponent::IsGuarding() const
{
	return EquippedWeaponType == EAlpineWeaponType::SwordAndShield &&
		bRoleActionActive;
}

bool UAlpineWeaponComponent::IsPrecisionAiming() const
{
	return EquippedWeaponType == EAlpineWeaponType::Bow &&
		bRoleActionActive;
}

bool UAlpineWeaponComponent::IsGreatswordCharged() const
{
	return EquippedWeaponType == EAlpineWeaponType::Greatsword &&
		bRoleActionActive;
}

bool UAlpineWeaponComponent::EquipWeapon(EAlpineWeaponType NewWeaponType)
{
	AActor* OwnerActor = GetOwner();
	if (OwnerActor && !OwnerActor->HasAuthority())
	{
		ServerEquipWeapon(NewWeaponType);
		return true;
	}

	return ApplyEquippedWeapon(NewWeaponType);
}

bool UAlpineWeaponComponent::TryUsePrimaryAction()
{
	AActor* OwnerActor = GetOwner();
	if (OwnerActor && !OwnerActor->HasAuthority())
	{
		ServerUsePrimaryAction();
		return true;
	}

	return ExecutePrimaryAction();
}

bool UAlpineWeaponComponent::StartRoleAction()
{
	AActor* OwnerActor = GetOwner();
	if (OwnerActor && !OwnerActor->HasAuthority())
	{
		ServerSetRoleAction(true);
		return true;
	}

	return ExecuteStartRoleAction();
}

void UAlpineWeaponComponent::StopRoleAction()
{
	AActor* OwnerActor = GetOwner();
	if (OwnerActor && !OwnerActor->HasAuthority())
	{
		ServerSetRoleAction(false);
		return;
	}

	ExecuteStopRoleAction();
}

bool UAlpineWeaponComponent::IsLocationProtectedByGuard(
	const FVector& TargetLocation) const
{
	if (!IsGuarding())
	{
		return false;
	}

	const AActor* OwnerActor = GetOwner();
	if (!OwnerActor)
	{
		return false;
	}

	FVector GuardForward = OwnerActor->GetActorForwardVector();
	if (const AAlpineMercenaryCharacter* Character =
			Cast<AAlpineMercenaryCharacter>(OwnerActor))
	{
		if (const AController* Controller = Character->GetController())
		{
			const FRotator ControlYaw(
				0.0f,
				Controller->GetControlRotation().Yaw,
				0.0f);
			GuardForward = ControlYaw.Vector();
		}
	}

	return IsLocationProtectedByAlpineGuard(
		OwnerActor->GetActorLocation(),
		GuardForward,
		TargetLocation);
}

const FAlpineWeaponDefinition& UAlpineWeaponComponent::GetCurrentDefinition() const
{
	return GetAlpineWeaponDefinition(EquippedWeaponType);
}

void UAlpineWeaponComponent::OnRep_EquippedWeapon()
{
	RebuildWeaponVisuals();
	OnWeaponStateChanged.Broadcast();
}

void UAlpineWeaponComponent::OnRep_WeaponState()
{
	OnWeaponStateChanged.Broadcast();
}

void UAlpineWeaponComponent::ServerEquipWeapon_Implementation(
	EAlpineWeaponType NewWeaponType)
{
	ApplyEquippedWeapon(NewWeaponType);
}

void UAlpineWeaponComponent::ServerUsePrimaryAction_Implementation()
{
	ExecutePrimaryAction();
}

void UAlpineWeaponComponent::ServerSetRoleAction_Implementation(bool bActive)
{
	if (bActive)
	{
		ExecuteStartRoleAction();
	}
	else
	{
		ExecuteStopRoleAction();
	}
}

bool UAlpineWeaponComponent::ApplyEquippedWeapon(
	EAlpineWeaponType NewWeaponType)
{
	switch (NewWeaponType)
	{
	case EAlpineWeaponType::SwordAndShield:
	case EAlpineWeaponType::Bow:
	case EAlpineWeaponType::Greatsword:
		break;
	default:
		return false;
	}

	if (EquippedWeaponType == NewWeaponType)
	{
		return false;
	}

	ExecuteStopRoleAction();
	EquippedWeaponType = NewWeaponType;
	NextPrimaryActionTime = 0.0f;
	LastHitCount = 0;
	LastActionDamage = 0.0f;
	RebuildWeaponVisuals();
	OnWeaponStateChanged.Broadcast();
	return true;
}

bool UAlpineWeaponComponent::ExecutePrimaryAction()
{
	UWorld* World = GetWorld();
	const float CurrentTime = World ? World->GetTimeSeconds() : 0.0f;
	if (World && CurrentTime + KINDA_SMALL_NUMBER < NextPrimaryActionTime)
	{
		return false;
	}
	if (IsGuarding())
	{
		return false;
	}

	UAlpineVitalsComponent* Vitals = GetOwnerVitals();
	const FAlpineWeaponDefinition& Definition = GetCurrentDefinition();
	if (Vitals && !Vitals->TryConsumeStamina(Definition.PrimaryStaminaCost))
	{
		return false;
	}

	const bool bChargedGreatsword = IsGreatswordCharged();
	const bool bRoleDamageActive =
		IsPrecisionAiming() || bChargedGreatsword;
	LastActionDamage =
		CalculateAlpineWeaponDamage(EquippedWeaponType, bRoleDamageActive);

	if (bChargedGreatsword)
	{
		bRoleActionActive = false;
	}

	SetActionState(EAlpineWeaponActionState::PrimaryAttack);
	LastHitCount = Definition.bRanged
		? PerformRangedTrace(LastActionDamage)
		: PerformMeleeTrace(LastActionDamage);
	NextPrimaryActionTime = CurrentTime + Definition.PrimaryCooldown;

	if (World)
	{
		World->GetTimerManager().SetTimer(
			ActionResetTimer,
			this,
			&UAlpineWeaponComponent::FinishPrimaryAction,
			FMath::Min(Definition.PrimaryCooldown, 0.3f),
			false);
	}
	else
	{
		FinishPrimaryAction();
	}

	OnWeaponStateChanged.Broadcast();
	return true;
}

bool UAlpineWeaponComponent::ExecuteStartRoleAction()
{
	if (bRoleActionActive ||
		ActionState == EAlpineWeaponActionState::PrimaryAttack)
	{
		return false;
	}

	UAlpineVitalsComponent* Vitals = GetOwnerVitals();
	if (Vitals &&
		!Vitals->TryConsumeStamina(GetCurrentDefinition().RoleStartStaminaCost))
	{
		return false;
	}

	bRoleActionActive = true;
	SetActionState(EAlpineWeaponActionState::RoleAction);
	OnWeaponStateChanged.Broadcast();
	return true;
}

void UAlpineWeaponComponent::ExecuteStopRoleAction()
{
	if (!bRoleActionActive)
	{
		return;
	}

	bRoleActionActive = false;
	if (ActionState == EAlpineWeaponActionState::RoleAction)
	{
		SetActionState(EAlpineWeaponActionState::Ready);
	}
	OnWeaponStateChanged.Broadcast();
}

int32 UAlpineWeaponComponent::PerformMeleeTrace(float Damage)
{
	AAlpineMercenaryCharacter* Character =
		Cast<AAlpineMercenaryCharacter>(GetOwner());
	UWorld* World = GetWorld();
	if (!Character || !World)
	{
		return 0;
	}

	FVector Forward = Character->GetActorForwardVector();
	if (const AController* Controller = Character->GetController())
	{
		const FRotator ControlYaw(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
		Forward = ControlYaw.Vector();
	}

	const FAlpineWeaponDefinition& Definition = GetCurrentDefinition();
	const FVector Start =
		Character->GetActorLocation() + FVector::UpVector * 55.0f + Forward * 35.0f;
	const FVector End = Start + Forward * Definition.PrimaryRange;
	FCollisionQueryParams QueryParams(
		SCENE_QUERY_STAT(AlpineWeaponMelee),
		false,
		Character);
	TArray<FHitResult> Hits;
	World->SweepMultiByChannel(
		Hits,
		Start,
		End,
		FQuat::Identity,
		ECC_Pawn,
		FCollisionShape::MakeSphere(Definition.TraceRadius),
		QueryParams);

	TSet<AActor*> DamagedActors;
	for (const FHitResult& Hit : Hits)
	{
		AActor* HitActor = Hit.GetActor();
		if (!HitActor || HitActor == Character || DamagedActors.Contains(HitActor))
		{
			continue;
		}

		DamagedActors.Add(HitActor);
		UGameplayStatics::ApplyPointDamage(
			HitActor,
			Damage,
			Forward,
			Hit,
			Character->GetController(),
			Character,
			nullptr);
	}
	return DamagedActors.Num();
}

int32 UAlpineWeaponComponent::PerformRangedTrace(float Damage)
{
	AAlpineMercenaryCharacter* Character =
		Cast<AAlpineMercenaryCharacter>(GetOwner());
	UWorld* World = GetWorld();
	if (!Character || !World)
	{
		return 0;
	}

	FVector ViewLocation = Character->GetActorLocation() + FVector::UpVector * 70.0f;
	FRotator ViewRotation = Character->GetActorRotation();
	if (AController* Controller = Character->GetController())
	{
		Controller->GetPlayerViewPoint(ViewLocation, ViewRotation);
	}

	const FVector ShotDirection = ViewRotation.Vector();
	const FVector End =
		ViewLocation + ShotDirection * GetCurrentDefinition().PrimaryRange;
	FCollisionQueryParams QueryParams(
		SCENE_QUERY_STAT(AlpineWeaponRanged),
		true,
		Character);
	FHitResult Hit;
	if (!World->LineTraceSingleByChannel(
			Hit,
			ViewLocation,
			End,
			ECC_Visibility,
			QueryParams))
	{
		return 0;
	}

	AActor* HitActor = Hit.GetActor();
	if (!HitActor || HitActor == Character)
	{
		return 0;
	}

	UGameplayStatics::ApplyPointDamage(
		HitActor,
		Damage,
		ShotDirection,
		Hit,
		Character->GetController(),
		Character,
		nullptr);
	return 1;
}

void UAlpineWeaponComponent::FinishPrimaryAction()
{
	SetActionState(
		bRoleActionActive
			? EAlpineWeaponActionState::RoleAction
			: EAlpineWeaponActionState::Ready);
	OnWeaponStateChanged.Broadcast();
}

void UAlpineWeaponComponent::SetActionState(
	EAlpineWeaponActionState NewState)
{
	ActionState = NewState;
}

void UAlpineWeaponComponent::RebuildWeaponVisuals()
{
	DestroyWeaponVisuals();

	const UWorld* World = GetWorld();
	if (!World || World->GetNetMode() == NM_DedicatedServer)
	{
		return;
	}

	MainHandVisual = SpawnWeaponVisual(false);
	if (GetCurrentDefinition().bHasOffhandVisual)
	{
		OffhandVisual = SpawnWeaponVisual(true);
	}
}

void UAlpineWeaponComponent::DestroyWeaponVisuals()
{
	if (MainHandVisual)
	{
		MainHandVisual->Destroy();
		MainHandVisual = nullptr;
	}
	if (OffhandVisual)
	{
		OffhandVisual->Destroy();
		OffhandVisual = nullptr;
	}
}

AAlpineWeaponVisualActor* UAlpineWeaponComponent::SpawnWeaponVisual(
	bool bOffhand)
{
	AAlpineMercenaryCharacter* Character =
		Cast<AAlpineMercenaryCharacter>(GetOwner());
	UWorld* World = GetWorld();
	if (!Character || !World || !Character->GetMesh())
	{
		return nullptr;
	}

	FActorSpawnParameters SpawnParameters;
	SpawnParameters.Owner = Character;
	SpawnParameters.Instigator = Character;
	SpawnParameters.SpawnCollisionHandlingOverride =
		ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AAlpineWeaponVisualActor* Visual =
		World->SpawnActor<AAlpineWeaponVisualActor>(
			FVector::ZeroVector,
			FRotator::ZeroRotator,
			SpawnParameters);
	if (!Visual)
	{
		return nullptr;
	}

	const FName HandBone =
		bOffhand || EquippedWeaponType == EAlpineWeaponType::Bow
			? FName(TEXT("hand_l"))
			: FName(TEXT("hand_r"));
	Visual->AttachToComponent(
		Character->GetMesh(),
		FAttachmentTransformRules::SnapToTargetNotIncludingScale,
		HandBone);
	Visual->ConfigureForWeapon(EquippedWeaponType, bOffhand);
	return Visual;
}

UAlpineVitalsComponent* UAlpineWeaponComponent::GetOwnerVitals() const
{
	const AAlpineMercenaryCharacter* Character =
		Cast<AAlpineMercenaryCharacter>(GetOwner());
	return Character ? Character->GetVitalsComponent() : nullptr;
}
