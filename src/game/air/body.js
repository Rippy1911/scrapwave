// Each aircraft's own Rapier rigid body: kinematic (the arcade flight model owns the motion), with a box collider
// the size of its hitbox, so cars bump into a parked or low-flying aircraft. Created lazily once Rapier is ready.
import { RAPIER, getPhys } from "@/game/vehicles/rapier";

export function createAirBody(world, hit) {
  let rb = null, P = null;
  const ensure = (pos, quat) => {
    if (rb) return true;
    P = getPhys(world);
    if (!P) return false;
    const [hx, hy, hz] = hit.half, c = hit.center;
    rb = P.R.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z).setRotation(quat));
    P.R.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(c[0], c[1], c[2]).setFriction(0.4).setRestitution(0.2), rb);
    return true;
  };
  return {
    move(pos, quat) {
      if (!ensure(pos, quat)) return;
      rb.setNextKinematicTranslation(pos);
      rb.setNextKinematicRotation(quat);
    },
    remove() {
      if (rb && P && P.R) P.R.removeRigidBody(rb);
      rb = null;
    },
    get rb() { return rb; },
  };
}