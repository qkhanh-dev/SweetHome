import { roleAllows } from '../../common/guards/roles.guard';

describe('UML RBAC inheritance', () => {
  test('ADMIN inherits STAFF', () => expect(roleAllows('ADMIN', 'STAFF')).toBe(true));
  test('STAFF cannot access ADMIN', () => expect(roleAllows('STAFF', 'ADMIN')).toBe(false));
  test('CUSTOMER cannot access STAFF', () => expect(roleAllows('CUSTOMER', 'STAFF')).toBe(false));
  test('ADMIN cannot impersonate CUSTOMER', () => expect(roleAllows('ADMIN', 'CUSTOMER')).toBe(false));
});
