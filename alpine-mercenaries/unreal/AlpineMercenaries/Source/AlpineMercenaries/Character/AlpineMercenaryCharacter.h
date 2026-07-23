#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AlpineMercenaryCharacter.generated.h"

class UAlpineVitalsComponent;
class UAlpineWeaponComponent;
class UAnimInstance;
class UAnimSequence;
class UCameraComponent;
class UInputAction;
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
	virtual float TakeDamage(
		float DamageAmount,
		const FDamageEvent& DamageEvent,
		AController* EventInstigator,
		AActor* DamageCauser) override;
	virtual void GetLifetimeReplicatedProps(
		TArray<FLifetimeProperty>& OutLifetimeProps) const override;

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

	UFUNCTION(BlueprintPure, Category = "Alpine|Animation")
	UAnimSequence* GetCrouchIdleAnimation() const { return CrouchIdleAnimation; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Animation")
	UAnimSequence* GetCrouchWalkAnimation() const { return CrouchWalkAnimation; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Vitals")
	UAlpineVitalsComponent* GetVitalsComponent() const { return VitalsComponent; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Weapon")
	UAlpineWeaponComponent* GetWeaponComponent() const { return WeaponComponent; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Defense")
	int32 GetBlockedPointHitCount() const { return BlockedPointHitCount; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Defense")
	float GetLastBlockedDamage() const { return LastBlockedDamage; }

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Alpine|Vitals", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UAlpineVitalsComponent> VitalsComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Alpine|Weapon", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UAlpineWeaponComponent> WeaponComponent;

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

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float PrecisionAimFieldOfView = 68.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float DefaultCameraArmLength = 340.0f;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float PrecisionAimArmLength = 260.0f;

	UPROPERTY()
	TObjectPtr<UAnimSequence> CrouchIdleAnimation;

	UPROPERTY()
	TObjectPtr<UAnimSequence> CrouchWalkAnimation;

	bool bSprintRequested = false;
	bool bWalkRequested = false;
	bool bOverrideAnimationActive = false;
	float ShoulderSide = 1.0f;
	TSubclassOf<UAnimInstance> DefaultAnimationClass;
	TObjectPtr<UAnimSequence> ActiveOverrideAnimation;

	UPROPERTY(VisibleInstanceOnly, Category = "Alpine|Movement")
	EAlpineLocomotionMode LocomotionMode = EAlpineLocomotionMode::Jogging;

	UPROPERTY(
		VisibleInstanceOnly,
		Replicated,
		Category = "Alpine|Defense")
	int32 BlockedPointHitCount = 0;

	UPROPERTY(
		VisibleInstanceOnly,
		Replicated,
		Category = "Alpine|Defense")
	float LastBlockedDamage = 0.0f;

	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void AttemptJump();
	void StartSprint();
	void StopSprint();
	void StartWalk();
	void StopWalk();
	void ToggleCrouch();
	void ToggleShoulder();
	void UsePrimaryWeaponAction();
	void StartWeaponRoleAction();
	void StopWeaponRoleAction();
	void UseWeaponSkillSlot1();
	void UseWeaponSkillSlot2();
	void UseWeaponSkillSlot3();
	void RefreshLocomotionMode();
	void ConsumeMovementStamina(float DeltaSeconds);
	void UpdateCamera(float DeltaSeconds);
	void UpdateCharacterAnimation();
	void PlayOverrideAnimation(UAnimSequence* Animation, bool bLooping, float PlayRate = 1.0f);
	void RestoreDefaultAnimation();
	void SetLocomotionMode(EAlpineLocomotionMode NewMode, float NewMaxSpeed);
};
