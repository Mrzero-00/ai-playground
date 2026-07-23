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
	DOREPLIFETIME(UAlpineWeaponComponent, ActiveSpecialAttackSlot);
	DOREPLIFETIME(UAlpineWeaponComponent, ActivePrimaryComboStep);
	DOREPLIFETIME(UAlpineWeaponComponent, NextPrimaryComboStep);
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
		const FAlpinePrimaryComboStepDefinition* Combo =
			FindAlpinePrimaryComboStepDefinition(
				EquippedWeaponType,
				ActivePrimaryComboStep);
		return Combo ? Combo->MotionName : FName(TEXT("ATTACK"));
	}
	if (ActionState == EAlpineWeaponActionState::SpecialAttack)
	{
		const FAlpineSpecialAttackDefinition* SpecialAttack =
			FindAlpineSpecialAttackDefinition(
				EquippedWeaponType,
				ActiveSpecialAttackSlot);
		return SpecialAttack ? SpecialAttack->DisplayName : FName(TEXT("SPECIAL"));
	}
	if (ActionState == EAlpineWeaponActionState::WeaponSpecial)
	{
		switch (EquippedWeaponType)
		{
		case EAlpineWeaponType::Bow:
			return TEXT("FOCUSED SHOT");
		case EAlpineWeaponType::Greatsword:
			return TEXT("CHARGED SLASH");
		case EAlpineWeaponType::SwordAndShield:
		default:
			return TEXT("GUARD");
		}
	}
	if (bRoleActionActive)
	{
		return GetRoleActionLabel();
	}
	return TEXT("READY");
}

FName UAlpineWeaponComponent::GetNextPrimaryAttackLabel() const
{
	const FAlpinePrimaryComboStepDefinition* Combo =
		FindAlpinePrimaryComboStepDefinition(
			EquippedWeaponType,
			NextPrimaryComboStep);
	return Combo ? Combo->MotionName : FName(TEXT("PRIMARY ATTACK"));
}

FName UAlpineWeaponComponent::GetSpecialAttackLabel(int32 SlotNumber) const
{
	const FAlpineSpecialAttackDefinition* SpecialAttack =
		FindAlpineSpecialAttackDefinition(
			EquippedWeaponType,
			static_cast<EAlpineSpecialAttackSlot>(SlotNumber));
	return SpecialAttack
		? SpecialAttack->DisplayName
		: FName(TEXT("UNASSIGNED"));
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

bool UAlpineWeaponComponent::TryUseSpecialAttack(int32 SlotNumber)
{
	AActor* OwnerActor = GetOwner();
	if (OwnerActor && !OwnerActor->HasAuthority())
	{
		ServerUseSpecialAttack(SlotNumber);
		return SlotNumber >= 1 && SlotNumber <= 3;
	}

	return ExecuteSpecialAttack(SlotNumber);
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

bool UAlpineWeaponComponent::ReleaseRoleAction()
{
	AActor* OwnerActor = GetOwner();
	if (OwnerActor && !OwnerActor->HasAuthority())
	{
		ServerReleaseRoleAction();
		return bRoleActionActive;
	}

	return ExecuteReleaseRoleAction();
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

	return IsAlpinePointDamageBlocked(
		IsGuarding(),
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
	if (ActionState == EAlpineWeaponActionState::PrimaryAttack &&
		ActivePrimaryComboStep > 0 &&
		MainHandVisual)
	{
		MainHandVisual->PlayPrimaryComboMotion(
			EquippedWeaponType,
			ActivePrimaryComboStep,
			FMath::Min(GetCurrentDefinition().PrimaryCooldown, 0.45f));
	}
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

void UAlpineWeaponComponent::ServerUseSpecialAttack_Implementation(
	int32 SlotNumber)
{
	ExecuteSpecialAttack(SlotNumber);
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

void UAlpineWeaponComponent::ServerReleaseRoleAction_Implementation()
{
	ExecuteReleaseRoleAction();
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
	for (float& NextSpecialActionTime : NextSpecialActionTimes)
	{
		NextSpecialActionTime = 0.0f;
	}
	LastHitCount = 0;
	LastActionDamage = 0.0f;
	ActiveSpecialAttackSlot = EAlpineSpecialAttackSlot::None;
	LastSpecialAttackSlot = EAlpineSpecialAttackSlot::None;
	ActivePrimaryComboStep = 0;
	LastPrimaryComboStep = 0;
	ResetPrimaryCombo();
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
	if (bRoleActionActive ||
		ActionState == EAlpineWeaponActionState::PrimaryAttack ||
		ActionState == EAlpineWeaponActionState::SpecialAttack ||
		ActionState == EAlpineWeaponActionState::WeaponSpecial)
	{
		return false;
	}

	UAlpineVitalsComponent* Vitals = GetOwnerVitals();
	const FAlpineWeaponDefinition& Definition = GetCurrentDefinition();
	const FAlpinePrimaryComboStepDefinition* Combo =
		FindAlpinePrimaryComboStepDefinition(
			EquippedWeaponType,
			NextPrimaryComboStep);
	if (!Combo)
	{
		ResetPrimaryCombo();
		Combo = FindAlpinePrimaryComboStepDefinition(
			EquippedWeaponType,
			NextPrimaryComboStep);
	}
	if (!Combo)
	{
		return false;
	}
	if (Vitals && !Vitals->TryConsumeStamina(Definition.PrimaryStaminaCost))
	{
		return false;
	}

	LastActionDamage = CalculateAlpinePrimaryComboDamage(
		EquippedWeaponType,
		Combo->ComboStep,
		false);

	SetActionState(EAlpineWeaponActionState::PrimaryAttack);
	ActiveSpecialAttackSlot = EAlpineSpecialAttackSlot::None;
	ActivePrimaryComboStep = Combo->ComboStep;
	LastPrimaryComboStep = Combo->ComboStep;
	LastHitCount = Definition.bRanged
		? PerformRangedTrace(LastActionDamage, Combo->Range)
		: PerformMeleeTrace(
			LastActionDamage,
			Combo->Range,
			Combo->TraceRadius);
	if (MainHandVisual)
	{
		MainHandVisual->PlayPrimaryComboMotion(
			EquippedWeaponType,
			Combo->ComboStep,
			FMath::Min(Definition.PrimaryCooldown, 0.45f));
	}
	NextPrimaryActionTime = CurrentTime + Definition.PrimaryCooldown;
	NextPrimaryComboStep = Combo->ComboStep % 3 + 1;

	if (World)
	{
		World->GetTimerManager().SetTimer(
			WeaponActionResetTimer,
			this,
			&UAlpineWeaponComponent::FinishWeaponAction,
			FMath::Min(Definition.PrimaryCooldown, 0.3f),
			false);
		World->GetTimerManager().SetTimer(
			PrimaryComboResetTimer,
			this,
			&UAlpineWeaponComponent::ResetPrimaryCombo,
			PrimaryComboResetDelay,
			false);
	}
	else
	{
		FinishWeaponAction();
	}

	OnWeaponStateChanged.Broadcast();
	return true;
}

bool UAlpineWeaponComponent::ExecuteSpecialAttack(int32 SlotNumber)
{
	const EAlpineSpecialAttackSlot Slot =
		static_cast<EAlpineSpecialAttackSlot>(SlotNumber);
	const FAlpineSpecialAttackDefinition* SpecialAttack =
		FindAlpineSpecialAttackDefinition(EquippedWeaponType, Slot);
	if (!SpecialAttack)
	{
		return false;
	}

	UWorld* World = GetWorld();
	const float CurrentTime = World ? World->GetTimeSeconds() : 0.0f;
	const int32 SlotIndex = SlotNumber - 1;
	if (World &&
		CurrentTime + KINDA_SMALL_NUMBER <
			NextSpecialActionTimes[SlotIndex])
	{
		return false;
	}
	if (bRoleActionActive ||
		ActionState == EAlpineWeaponActionState::PrimaryAttack ||
		ActionState == EAlpineWeaponActionState::SpecialAttack ||
		ActionState == EAlpineWeaponActionState::WeaponSpecial)
	{
		return false;
	}

	UAlpineVitalsComponent* Vitals = GetOwnerVitals();
	if (Vitals && !Vitals->TryConsumeStamina(SpecialAttack->StaminaCost))
	{
		return false;
	}

	LastActionDamage = CalculateAlpineSpecialAttackDamage(
		EquippedWeaponType,
		Slot,
		false);

	ActiveSpecialAttackSlot = Slot;
	ActivePrimaryComboStep = 0;
	LastSpecialAttackSlot = Slot;
	SetActionState(EAlpineWeaponActionState::SpecialAttack);
	LastHitCount = SpecialAttack->bRanged
		? PerformRangedTrace(LastActionDamage, SpecialAttack->Range)
		: PerformMeleeTrace(
			LastActionDamage,
			SpecialAttack->Range,
			SpecialAttack->TraceRadius);
	NextSpecialActionTimes[SlotIndex] =
		CurrentTime + SpecialAttack->Cooldown;

	if (World)
	{
		World->GetTimerManager().SetTimer(
			WeaponActionResetTimer,
			this,
			&UAlpineWeaponComponent::FinishWeaponAction,
			FMath::Min(SpecialAttack->Cooldown, 0.45f),
			false);
	}
	else
	{
		FinishWeaponAction();
	}

	OnWeaponStateChanged.Broadcast();
	return true;
}

bool UAlpineWeaponComponent::ExecuteStartRoleAction()
{
	if (bRoleActionActive ||
		ActionState == EAlpineWeaponActionState::PrimaryAttack ||
		ActionState == EAlpineWeaponActionState::SpecialAttack ||
		ActionState == EAlpineWeaponActionState::WeaponSpecial)
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

bool UAlpineWeaponComponent::ExecuteReleaseRoleAction()
{
	if (!bRoleActionActive)
	{
		return false;
	}

	if (EquippedWeaponType == EAlpineWeaponType::SwordAndShield)
	{
		ExecuteStopRoleAction();
		return true;
	}

	const FAlpineWeaponDefinition& Definition = GetCurrentDefinition();
	UWorld* World = GetWorld();
	const float CurrentTime = World ? World->GetTimeSeconds() : 0.0f;
	if (World && CurrentTime + KINDA_SMALL_NUMBER < NextPrimaryActionTime)
	{
		ExecuteStopRoleAction();
		return false;
	}

	UAlpineVitalsComponent* Vitals = GetOwnerVitals();
	if (Vitals && !Vitals->TryConsumeStamina(Definition.PrimaryStaminaCost))
	{
		ExecuteStopRoleAction();
		return false;
	}

	LastActionDamage =
		CalculateAlpineWeaponDamage(EquippedWeaponType, true);
	bRoleActionActive = false;
	ActiveSpecialAttackSlot = EAlpineSpecialAttackSlot::None;
	ActivePrimaryComboStep = 0;
	SetActionState(EAlpineWeaponActionState::WeaponSpecial);
	LastHitCount = Definition.bRanged
		? PerformRangedTrace(LastActionDamage, Definition.PrimaryRange)
		: PerformMeleeTrace(
			LastActionDamage,
			Definition.PrimaryRange,
			Definition.TraceRadius);
	if (MainHandVisual)
	{
		MainHandVisual->PlayPrimaryComboMotion(
			EquippedWeaponType,
			3,
			FMath::Min(Definition.PrimaryCooldown, 0.45f));
	}
	NextPrimaryActionTime = CurrentTime + Definition.PrimaryCooldown;

	if (World)
	{
		World->GetTimerManager().SetTimer(
			WeaponActionResetTimer,
			this,
			&UAlpineWeaponComponent::FinishWeaponAction,
			FMath::Min(Definition.PrimaryCooldown, 0.45f),
			false);
	}
	else
	{
		FinishWeaponAction();
	}

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

int32 UAlpineWeaponComponent::PerformMeleeTrace(
	float Damage,
	float Range,
	float TraceRadius)
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

	const FVector Start =
		Character->GetActorLocation() + FVector::UpVector * 55.0f + Forward * 35.0f;
	const FVector End = Start + Forward * Range;
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
		FCollisionShape::MakeSphere(TraceRadius),
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

int32 UAlpineWeaponComponent::PerformRangedTrace(float Damage, float Range)
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
	const FVector End = ViewLocation + ShotDirection * Range;
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

void UAlpineWeaponComponent::FinishWeaponAction()
{
	ActiveSpecialAttackSlot = EAlpineSpecialAttackSlot::None;
	ActivePrimaryComboStep = 0;
	SetActionState(
		bRoleActionActive
			? EAlpineWeaponActionState::RoleAction
			: EAlpineWeaponActionState::Ready);
	OnWeaponStateChanged.Broadcast();
}

void UAlpineWeaponComponent::ResetPrimaryCombo()
{
	NextPrimaryComboStep = 1;
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
