export class UserError extends Error {}
export class CancelledError extends UserError {
  constructor() { super('The vault changed or was locked. Please unlock again.'); }
}
