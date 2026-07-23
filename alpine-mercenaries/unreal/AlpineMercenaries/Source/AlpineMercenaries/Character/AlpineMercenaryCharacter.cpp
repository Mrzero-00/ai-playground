#include "Character/AlpineMercenaryCharacter.h"

#include "AlpineMercenaries.h"
#include "Animation/AnimSequence.h"
#include "Animation/AnimSingleNodeInstance.h"
#include "Camera/CameraComponent.h"
#include "Character/AlpineVitalsComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "EnhancedInputComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/Controller.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputCoreTypes.h"
#include "UObject/ConstructorHelpers.h"
#include "Weapon/AlpineWeaponComponent.h"
#include "Weapon/AlpineWeaponTypes.h"

AAlpineMercenaryCharacter::AAlpineMercenaryCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	VitalsComponent = CreateDefaultSubobject<UAlpineVitalsComponent>(TEXT("VitalsComponent"));
	WeaponComponent = CreateDefaultSubobject<UAlpineWeaponComponent>(TEXT("WeaponComponent"));

	GetCapsuleComponent()->InitCapsuleSize(42.0f, 96.0f);

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = true;
	Movement->RotationRate = FRotator(0.0f, 540.0f, 0.0f);
	Movement->JumpZVelocity = 520.0f;
	Movement->AirControl = 0.35f;
	Movement->MaxWalkSpeed = JoggingSpeed;
	Movement->MaxWalkSpeedCrouched = CrouchingSpeed;
	Movement->MinAnalogWalkSpeed = 20.0f;
	Movement->BrakingDecelerationWalking = 1800.0f;
	Movement->BrakingDecelerationFalling = 1400.0f;
	Movement->GetNavAgentPropertiesRef().bCanCrouch = true;

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = DefaultCameraArmLength;
	CameraBoom->TargetOffset = FVector(0.0f, 0.0f, StandingCameraHeight);
	CameraBoom->SocketOffset = FVector(0.0f, ShoulderOffset, 0.0f);
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 18.0f;
	CameraBoom->CameraLagMaxDistance = 35.0f;
	CameraBoom->bEnableCameraRotationLag = true;
	CameraBoom->CameraRotationLagSpeed = 22.0f;
	CameraBoom->bDoCollisionTest = true;
	CameraBoom->ProbeSize = 12.0f;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;
	FollowCamera->FieldOfView = DefaultFieldOfView;

	static ConstructorHelpers::FObjectFinder<USkeletalMesh> CharacterMesh(
		TEXT("/Game/Characters/Mannequins/Meshes/SKM_Quinn_Simple.SKM_Quinn_Simple"));
	if (CharacterMesh.Succeeded())
	{
		GetMesh()->SetSkeletalMeshAsset(CharacterMesh.Object);
		GetMesh()->SetRelativeLocation(FVector(0.0f, 0.0f, -96.0f));
		GetMesh()->SetRelativeRotation(FRotator(0.0f, -90.0f, 0.0f));
	}

	static ConstructorHelpers::FClassFinder<UAnimInstance> CharacterAnimation(
		TEXT("/Game/Characters/Mannequins/Anims/Unarmed/ABP_Unarmed"));
	if (CharacterAnimation.Succeeded())
	{
		GetMesh()->SetAnimInstanceClass(CharacterAnimation.Class);
		DefaultAnimationClass = CharacterAnimation.Class;
	}

	static ConstructorHelpers::FObjectFinder<UAnimSequence> CrouchIdleAnimationAsset(
		TEXT("/Game/Alpine/Animations/AM_Crouch_Idle.AM_Crouch_Idle"));
	static ConstructorHelpers::FObjectFinder<UAnimSequence> CrouchWalkAnimationAsset(
		TEXT("/Game/Alpine/Animations/AM_Crouch_Walk_Fwd.AM_Crouch_Walk_Fwd"));

	CrouchIdleAnimation = CrouchIdleAnimationAsset.Object;
	CrouchWalkAnimation = CrouchWalkAnimationAsset.Object;

	static ConstructorHelpers::FObjectFinder<UInputAction> JumpInput(
		TEXT("/Game/Input/Actions/IA_Jump.IA_Jump"));
	static ConstructorHelpers::FObjectFinder<UInputAction> MoveInput(
		TEXT("/Game/Input/Actions/IA_Move.IA_Move"));
	static ConstructorHelpers::FObjectFinder<UInputAction> LookInput(
		TEXT("/Game/Input/Actions/IA_Look.IA_Look"));
	static ConstructorHelpers::FObjectFinder<UInputAction> MouseLookInput(
		TEXT("/Game/Input/Actions/IA_MouseLook.IA_MouseLook"));

	JumpAction = JumpInput.Object;
	MoveAction = MoveInput.Object;
	LookAction = LookInput.Object;
	MouseLookAction = MouseLookInput.Object;
}

void AAlpineMercenaryCharacter::BeginPlay()
{
	Super::BeginPlay();

	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	RefreshLocomotionMode();
	ConsumeMovementStamina(DeltaSeconds);
	UpdateCamera(DeltaSeconds);
	UpdateCharacterAnimation();
}

void AAlpineMercenaryCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!EnhancedInput)
	{
		UE_LOG(LogAlpineMercenaries, Error, TEXT("Enhanced Input component is required for %s."), *GetName());
		return;
	}

	if (JumpAction)
	{
		EnhancedInput->BindAction(JumpAction, ETriggerEvent::Started, this, &AAlpineMercenaryCharacter::AttemptJump);
		EnhancedInput->BindAction(JumpAction, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
	}
	if (MoveAction)
	{
		EnhancedInput->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AAlpineMercenaryCharacter::Move);
	}
	if (LookAction)
	{
		EnhancedInput->BindAction(LookAction, ETriggerEvent::Triggered, this, &AAlpineMercenaryCharacter::Look);
	}
	if (MouseLookAction)
	{
		EnhancedInput->BindAction(MouseLookAction, ETriggerEvent::Triggered, this, &AAlpineMercenaryCharacter::Look);
	}

	PlayerInputComponent->BindKey(EKeys::LeftShift, IE_Pressed, this, &AAlpineMercenaryCharacter::StartSprint);
	PlayerInputComponent->BindKey(EKeys::LeftShift, IE_Released, this, &AAlpineMercenaryCharacter::StopSprint);
	PlayerInputComponent->BindKey(EKeys::Gamepad_LeftThumbstick, IE_Pressed, this, &AAlpineMercenaryCharacter::StartSprint);
	PlayerInputComponent->BindKey(EKeys::Gamepad_LeftThumbstick, IE_Released, this, &AAlpineMercenaryCharacter::StopSprint);

	PlayerInputComponent->BindKey(EKeys::LeftControl, IE_Pressed, this, &AAlpineMercenaryCharacter::StartWalk);
	PlayerInputComponent->BindKey(EKeys::LeftControl, IE_Released, this, &AAlpineMercenaryCharacter::StopWalk);

	PlayerInputComponent->BindKey(EKeys::C, IE_Pressed, this, &AAlpineMercenaryCharacter::ToggleCrouch);
	PlayerInputComponent->BindKey(EKeys::Gamepad_FaceButton_Right, IE_Pressed, this, &AAlpineMercenaryCharacter::ToggleCrouch);

	PlayerInputComponent->BindKey(EKeys::Q, IE_Pressed, this, &AAlpineMercenaryCharacter::ToggleShoulder);
	PlayerInputComponent->BindKey(EKeys::Gamepad_RightThumbstick, IE_Pressed, this, &AAlpineMercenaryCharacter::ToggleShoulder);

	PlayerInputComponent->BindKey(EKeys::LeftMouseButton, IE_Pressed, this, &AAlpineMercenaryCharacter::UsePrimaryWeaponAction);
	PlayerInputComponent->BindKey(EKeys::Gamepad_RightTrigger, IE_Pressed, this, &AAlpineMercenaryCharacter::UsePrimaryWeaponAction);
	PlayerInputComponent->BindKey(EKeys::RightMouseButton, IE_Pressed, this, &AAlpineMercenaryCharacter::StartWeaponRoleAction);
	PlayerInputComponent->BindKey(EKeys::RightMouseButton, IE_Released, this, &AAlpineMercenaryCharacter::StopWeaponRoleAction);
	PlayerInputComponent->BindKey(EKeys::Gamepad_LeftTrigger, IE_Pressed, this, &AAlpineMercenaryCharacter::StartWeaponRoleAction);
	PlayerInputComponent->BindKey(EKeys::Gamepad_LeftTrigger, IE_Released, this, &AAlpineMercenaryCharacter::StopWeaponRoleAction);

	PlayerInputComponent->BindKey(EKeys::One, IE_Pressed, this, &AAlpineMercenaryCharacter::UseWeaponSkillSlot1);
	PlayerInputComponent->BindKey(EKeys::Two, IE_Pressed, this, &AAlpineMercenaryCharacter::UseWeaponSkillSlot2);
	PlayerInputComponent->BindKey(EKeys::Three, IE_Pressed, this, &AAlpineMercenaryCharacter::UseWeaponSkillSlot3);
	PlayerInputComponent->BindKey(EKeys::Gamepad_FaceButton_Left, IE_Pressed, this, &AAlpineMercenaryCharacter::UseWeaponSkillSlot1);
	PlayerInputComponent->BindKey(EKeys::Gamepad_FaceButton_Top, IE_Pressed, this, &AAlpineMercenaryCharacter::UseWeaponSkillSlot2);
	PlayerInputComponent->BindKey(EKeys::Gamepad_RightShoulder, IE_Pressed, this, &AAlpineMercenaryCharacter::UseWeaponSkillSlot3);
}

void AAlpineMercenaryCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D MovementVector = Value.Get<FVector2D>();
	if (!Controller)
	{
		return;
	}

	const FRotator ControlRotation = Controller->GetControlRotation();
	const FRotator YawRotation(0.0f, ControlRotation.Yaw, 0.0f);
	const FVector ForwardDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
	const FVector RightDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

	AddMovementInput(ForwardDirection, MovementVector.Y);
	AddMovementInput(RightDirection, MovementVector.X);
}

void AAlpineMercenaryCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D LookVector = Value.Get<FVector2D>();
	AddControllerYawInput(LookVector.X);
	AddControllerPitchInput(LookVector.Y);
}

void AAlpineMercenaryCharacter::AttemptJump()
{
	if (!CanJump() || (VitalsComponent && !VitalsComponent->TryConsumeStamina(JumpStaminaCost)))
	{
		return;
	}

	Jump();
}

void AAlpineMercenaryCharacter::StartSprint()
{
	if (VitalsComponent && VitalsComponent->GetStamina() < MinimumStaminaToSprint)
	{
		return;
	}

	bSprintRequested = true;
	bWalkRequested = false;
	if (bIsCrouched)
	{
		UnCrouch();
	}
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::StopSprint()
{
	bSprintRequested = false;
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::StartWalk()
{
	bWalkRequested = true;
	bSprintRequested = false;
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::StopWalk()
{
	bWalkRequested = false;
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::ToggleCrouch()
{
	if (GetCharacterMovement()->IsFalling())
	{
		return;
	}

	if (VitalsComponent && !VitalsComponent->TryConsumeStamina(CrouchTransitionStaminaCost))
	{
		return;
	}

	bSprintRequested = false;
	if (bIsCrouched)
	{
		UnCrouch();
	}
	else
	{
		Crouch();
	}
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::ToggleShoulder()
{
	ShoulderSide *= -1.0f;
}

void AAlpineMercenaryCharacter::UsePrimaryWeaponAction()
{
	bSprintRequested = false;
	if (WeaponComponent)
	{
		WeaponComponent->TryUsePrimaryAction();
	}
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::StartWeaponRoleAction()
{
	bSprintRequested = false;
	if (WeaponComponent)
	{
		WeaponComponent->StartRoleAction();
	}
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::StopWeaponRoleAction()
{
	if (WeaponComponent)
	{
		WeaponComponent->ReleaseRoleAction();
	}
}

void AAlpineMercenaryCharacter::UseWeaponSkillSlot1()
{
	bSprintRequested = false;
	if (WeaponComponent)
	{
		WeaponComponent->TryUseSpecialAttack(1);
	}
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::UseWeaponSkillSlot2()
{
	bSprintRequested = false;
	if (WeaponComponent)
	{
		WeaponComponent->TryUseSpecialAttack(2);
	}
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::UseWeaponSkillSlot3()
{
	bSprintRequested = false;
	if (WeaponComponent)
	{
		WeaponComponent->TryUseSpecialAttack(3);
	}
	RefreshLocomotionMode();
}

void AAlpineMercenaryCharacter::RefreshLocomotionMode()
{
	UCharacterMovementComponent* Movement = GetCharacterMovement();
	if (Movement->IsFalling())
	{
		SetLocomotionMode(EAlpineLocomotionMode::Airborne, Movement->MaxWalkSpeed);
		return;
	}

	if (bIsCrouched)
	{
		SetLocomotionMode(EAlpineLocomotionMode::Crouching, CrouchingSpeed);
		return;
	}

	if (bWalkRequested)
	{
		SetLocomotionMode(EAlpineLocomotionMode::Walking, WalkingSpeed);
		return;
	}

	const bool bHasMovementIntent =
		GetVelocity().SizeSquared2D() > FMath::Square(10.0f) ||
		GetLastMovementInputVector().SizeSquared2D() > KINDA_SMALL_NUMBER;
	if (bSprintRequested && bHasMovementIntent)
	{
		SetLocomotionMode(EAlpineLocomotionMode::Sprinting, SprintingSpeed);
		return;
	}

	SetLocomotionMode(EAlpineLocomotionMode::Jogging, JoggingSpeed);
}

void AAlpineMercenaryCharacter::ConsumeMovementStamina(float DeltaSeconds)
{
	if (!VitalsComponent)
	{
		return;
	}

	const bool bHasMovementIntent =
		GetVelocity().SizeSquared2D() > FMath::Square(10.0f) ||
		GetLastMovementInputVector().SizeSquared2D() > KINDA_SMALL_NUMBER;
	const bool bPhysicalActionActive =
		bHasMovementIntent || GetCharacterMovement()->IsFalling();
	VitalsComponent->SetStaminaRegenerationPaused(bPhysicalActionActive);

	if (!bHasMovementIntent)
	{
		return;
	}

	float StaminaPerSecond = JoggingStaminaPerSecond;
	switch (LocomotionMode)
	{
	case EAlpineLocomotionMode::Walking:
		StaminaPerSecond = WalkingStaminaPerSecond;
		break;
	case EAlpineLocomotionMode::Sprinting:
		StaminaPerSecond = SprintingStaminaPerSecond;
		break;
	case EAlpineLocomotionMode::Crouching:
		StaminaPerSecond = CrouchingStaminaPerSecond;
		break;
	case EAlpineLocomotionMode::Jogging:
	case EAlpineLocomotionMode::Airborne:
	default:
		break;
	}

	VitalsComponent->ConsumeStamina(StaminaPerSecond * DeltaSeconds);
	if (LocomotionMode == EAlpineLocomotionMode::Sprinting &&
		VitalsComponent->GetStamina() <= KINDA_SMALL_NUMBER)
	{
		bSprintRequested = false;
		RefreshLocomotionMode();
	}
}

void AAlpineMercenaryCharacter::UpdateCamera(float DeltaSeconds)
{
	const float TargetShoulderY = ShoulderOffset * ShoulderSide;
	const float TargetHeight = bIsCrouched ? CrouchingCameraHeight : StandingCameraHeight;
	const bool bPrecisionAiming =
		WeaponComponent && WeaponComponent->IsPrecisionAiming();
	const float TargetFov = bPrecisionAiming
		? PrecisionAimFieldOfView
		: (LocomotionMode == EAlpineLocomotionMode::Sprinting
			? SprintFieldOfView
			: DefaultFieldOfView);
	const float TargetArmLength =
		bPrecisionAiming ? PrecisionAimArmLength : DefaultCameraArmLength;

	FVector SocketOffset = CameraBoom->SocketOffset;
	SocketOffset.Y = FMath::FInterpTo(SocketOffset.Y, TargetShoulderY, DeltaSeconds, 12.0f);
	CameraBoom->SocketOffset = SocketOffset;

	FVector TargetOffset = CameraBoom->TargetOffset;
	TargetOffset.Z = FMath::FInterpTo(TargetOffset.Z, TargetHeight, DeltaSeconds, 10.0f);
	CameraBoom->TargetOffset = TargetOffset;

	CameraBoom->TargetArmLength = FMath::FInterpTo(
		CameraBoom->TargetArmLength,
		TargetArmLength,
		DeltaSeconds,
		10.0f);

	const float NewFieldOfView =
		FMath::FInterpTo(FollowCamera->FieldOfView, TargetFov, DeltaSeconds, 8.0f);
	FollowCamera->SetFieldOfView(NewFieldOfView);
}

void AAlpineMercenaryCharacter::UpdateCharacterAnimation()
{
	if (bIsCrouched && CrouchIdleAnimation && CrouchWalkAnimation)
	{
		const float HorizontalSpeed = GetVelocity().Size2D();
		const bool bMoving = HorizontalSpeed > 5.0f;
		UAnimSequence* DesiredAnimation =
			bMoving ? CrouchWalkAnimation.Get() : CrouchIdleAnimation.Get();
		if (!bOverrideAnimationActive || ActiveOverrideAnimation != DesiredAnimation)
		{
			PlayOverrideAnimation(DesiredAnimation, true);
		}

		if (UAnimSingleNodeInstance* SingleNode = GetMesh()->GetSingleNodeInstance())
		{
			if (bMoving)
			{
				SingleNode->SetPlayRate(
					FMath::Clamp(HorizontalSpeed / CrouchingSpeed, 0.55f, 1.2f));
				SingleNode->SetPlaying(true);
			}
			else
			{
				SingleNode->SetPlaying(false);
				SingleNode->SetPosition(0.0f, false);
			}
		}
		return;
	}

	if (bOverrideAnimationActive)
	{
		RestoreDefaultAnimation();
	}
}

void AAlpineMercenaryCharacter::PlayOverrideAnimation(
	UAnimSequence* Animation,
	bool bLooping,
	float PlayRate)
{
	if (!Animation)
	{
		return;
	}

	GetMesh()->PlayAnimation(Animation, bLooping);
	if (UAnimSingleNodeInstance* SingleNode = GetMesh()->GetSingleNodeInstance())
	{
		SingleNode->SetPlayRate(PlayRate);
		SingleNode->SetPlaying(true);
	}
	bOverrideAnimationActive = true;
	ActiveOverrideAnimation = Animation;
}

void AAlpineMercenaryCharacter::RestoreDefaultAnimation()
{
	if (!bOverrideAnimationActive)
	{
		return;
	}

	GetMesh()->SetAnimationMode(EAnimationMode::AnimationBlueprint);
	if (DefaultAnimationClass)
	{
		GetMesh()->SetAnimInstanceClass(DefaultAnimationClass);
	}
	bOverrideAnimationActive = false;
	ActiveOverrideAnimation = nullptr;
}

void AAlpineMercenaryCharacter::SetLocomotionMode(
	EAlpineLocomotionMode NewMode,
	float NewMaxSpeed)
{
	GetCharacterMovement()->MaxWalkSpeed = NewMaxSpeed;
	GetCharacterMovement()->MaxWalkSpeedCrouched = CrouchingSpeed;

	if (LocomotionMode != NewMode)
	{
		LocomotionMode = NewMode;
		UE_LOG(
			LogAlpineMercenaries,
			Verbose,
			TEXT("%s locomotion changed to %d at %.0f cm/s."),
			*GetName(),
			static_cast<int32>(LocomotionMode),
			NewMaxSpeed);
	}
}
