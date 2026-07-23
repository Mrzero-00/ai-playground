#include "Character/AlpineMercenaryCharacter.h"

#include "AlpineMercenaries.h"
#include "Camera/CameraComponent.h"
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

AAlpineMercenaryCharacter::AAlpineMercenaryCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

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
	CameraBoom->TargetArmLength = 340.0f;
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
	}

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
	UpdateCamera(DeltaSeconds);
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
		EnhancedInput->BindAction(JumpAction, ETriggerEvent::Started, this, &ACharacter::Jump);
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

void AAlpineMercenaryCharacter::StartSprint()
{
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

void AAlpineMercenaryCharacter::UpdateCamera(float DeltaSeconds)
{
	const float TargetShoulderY = ShoulderOffset * ShoulderSide;
	const float TargetHeight = bIsCrouched ? CrouchingCameraHeight : StandingCameraHeight;
	const float TargetFov =
		LocomotionMode == EAlpineLocomotionMode::Sprinting ? SprintFieldOfView : DefaultFieldOfView;

	FVector SocketOffset = CameraBoom->SocketOffset;
	SocketOffset.Y = FMath::FInterpTo(SocketOffset.Y, TargetShoulderY, DeltaSeconds, 12.0f);
	CameraBoom->SocketOffset = SocketOffset;

	FVector TargetOffset = CameraBoom->TargetOffset;
	TargetOffset.Z = FMath::FInterpTo(TargetOffset.Z, TargetHeight, DeltaSeconds, 10.0f);
	CameraBoom->TargetOffset = TargetOffset;

	const float NewFieldOfView =
		FMath::FInterpTo(FollowCamera->FieldOfView, TargetFov, DeltaSeconds, 8.0f);
	FollowCamera->SetFieldOfView(NewFieldOfView);
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
