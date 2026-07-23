#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AlpineTestProjectile.generated.h"

class UPointLightComponent;
class UProjectileMovementComponent;
class USphereComponent;
class UStaticMeshComponent;

UCLASS()
class ALPINEMERCENARIES_API AAlpineTestProjectile : public AActor
{
	GENERATED_BODY()

public:
	AAlpineTestProjectile();

	UFUNCTION(BlueprintCallable, Category = "Alpine|Projectile Test")
	void InitializeVelocity(const FVector& Direction);

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	float GetDamage() const { return Damage; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	float GetProjectileSpeed() const { return ProjectileSpeed; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	float GetMaximumLifetime() const { return MaximumLifetime; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	USphereComponent* GetCollisionComponent() const { return CollisionSphere; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	UProjectileMovementComponent* GetProjectileMovement() const
	{
		return ProjectileMovement;
	}

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY(
		VisibleAnywhere,
		BlueprintReadOnly,
		Category = "Alpine|Projectile Test",
		meta = (AllowPrivateAccess = "true"))
	TObjectPtr<USphereComponent> CollisionSphere;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Projectile Test")
	TObjectPtr<UStaticMeshComponent> ProjectileMesh;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Projectile Test")
	TObjectPtr<UPointLightComponent> ProjectileLight;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Projectile Test")
	TObjectPtr<UProjectileMovementComponent> ProjectileMovement;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test",
		meta = (ClampMin = "0.0"))
	float Damage = 20.0f;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test",
		meta = (ClampMin = "1.0"))
	float ProjectileSpeed = 700.0f;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test",
		meta = (ClampMin = "0.1"))
	float MaximumLifetime = 8.0f;

	UFUNCTION()
	void HandleProjectileHit(
		UPrimitiveComponent* HitComponent,
		AActor* OtherActor,
		UPrimitiveComponent* OtherComponent,
		FVector NormalImpulse,
		const FHitResult& Hit);
};
