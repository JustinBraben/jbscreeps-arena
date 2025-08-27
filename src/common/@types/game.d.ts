import { Role } from '../enums/role';

declare module 'game/prototypes' {
  interface Creep {
    _role: Role;
    _level?: number;
    _state?: number;
    _states?: number[];
    _initialPos: Position;
  }
}
