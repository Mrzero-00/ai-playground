#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AlpineMercenaryCharacter.generated.h"

class UCameraComponent;
class UInputAction;
class UAlpineVitalsComponent;
class USpringArmComponent;
struct FInputActionValue;

UENUM(BlueprintType)
enum class EAlpineLocomotionMode : uint8
{
	Walking,
	Jogging,
	Sprinting,
	Crouching,
	Airborne
};

UCLASS()
class ALPINEMERCENARIES_API AAlpineMercenaryCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AAlpineMercenaryCharacter();

	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	UFUNCTION(BlueprintPure, Category = "Alpine|Camera")
	USpringArmComponent* GetCameraBoom() const { return CameraBoom; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Camera")
	UCameraComponent* GetFollowCamera() const { return FollowCamera; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Movement")
	EAlpineLocomotionMode GetLocomotionMode() const { return LocomotionMode; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Movement")
	float GetWalkingSpeed() const { return WalkingSpeed; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Movement")
	float GetJoggingSpeed() const { return JoggingSpeed; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Movement")
	float GetSprintingSpeed() const { return SprintingSpeed; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Movement")
	float GetCrouchingSpeed() const { return CrouchingSpeed; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	UAlpineVitalsComponent* GetVitalsComponent() const { return VitalsComponent; }

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Alpine|Vitals", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UAlpineVitalsComponent> VitalsComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Alpine|Camera", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Alpine|Camera", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UCameraComponent> FollowCamera;

	UPROPERTY()
	TObjectPtr<UInputAction> JumpAction;

	UPROPERTY()
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY()
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY()
	TObjectPtr<UInputAction> MouseLookAction;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Movement")
	float WalkingSpeed = 220.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Movement")
	float JoggingSpeed = 450.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Movement")
	float SprintingSpeed = 650.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Movement")
	float CrouchingSpeed = 200.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float WalkingStaminaPerSecond = 0.75f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float JoggingStaminaPerSecond = 2.5f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float SprintingStaminaPerSecond = 12.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float CrouchingStaminaPerSecond = 1.5f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float JumpStaminaCost = 15.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float CrouchTransitionStaminaCost = 3.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Vitals", meta = (ClampMin = "0.0"))
	float MinimumStaminaToSprint = 10.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float StandingCameraHeight = 76.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float CrouchingCameraHeight = 54.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float ShoulderOffset = 68.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float DefaultFieldOfView = 90.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float SprintFieldOfView = 96.0f;

	bool bSprintRequested = false;
	bool bWalkRequested = false;
	float ShoulderSide = 1.0f;

	UPROPERTY(VisibleInstanceOnly, Category = "Alpine|Movement")
	EAlpineLocomotionMode LocomotionMode = EAlpineLocomotionMode::Jogging;

	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void AttemptJump();
	void StartSprint();
	void StopSprint();
	void StartWalk();
	void StopWalk();
	void ToggleCrouch();
	void ToggleShoulder();
	void RefreshLocomotionMode();
	void ConsumeMovementStamina(float DeltaSeconds);
	void UpdateCamera(float DeltaSeconds);
	void SetLocomotionMode(EAlpineLocomotionMode NewMode, float NewMaxSpeed);
};
