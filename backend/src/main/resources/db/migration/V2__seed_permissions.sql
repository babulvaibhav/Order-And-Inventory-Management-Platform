-- Seeds the fixed catalog of permission codes. Must stay in sync with
-- com.uphead.platform.common.security.PermissionCodes#ALL.
INSERT INTO permissions (id, code, description, category) VALUES
    (gen_random_uuid(), 'product.read',        'View products',                         'product'),
    (gen_random_uuid(), 'product.write',       'Create, edit and disable products',     'product'),
    (gen_random_uuid(), 'warehouse.read',      'View warehouses',                       'warehouse'),
    (gen_random_uuid(), 'warehouse.write',     'Create, edit and disable warehouses',   'warehouse'),
    (gen_random_uuid(), 'inventory.read',      'View inventory levels',                 'inventory'),
    (gen_random_uuid(), 'inventory.update',    'Adjust, transfer and reserve inventory','inventory'),
    (gen_random_uuid(), 'order.read',          'View orders',                           'order'),
    (gen_random_uuid(), 'order.create',        'Create orders and advance their status','order'),
    (gen_random_uuid(), 'order.cancel',        'Cancel orders',                         'order'),
    (gen_random_uuid(), 'customer.read',       'View customers',                        'customer'),
    (gen_random_uuid(), 'customer.write',      'Create and edit customers',             'customer'),
    (gen_random_uuid(), 'user.read',           'View users in the organization',        'user'),
    (gen_random_uuid(), 'user.manage',         'Create, edit and deactivate users',     'user'),
    (gen_random_uuid(), 'audit.read',          'View the audit log',                    'audit'),
    (gen_random_uuid(), 'role.read',           'View roles and permissions',            'role'),
    (gen_random_uuid(), 'role.manage',         'Create, edit and delete roles',         'role'),
    (gen_random_uuid(), 'organization.read',   'View organizations (platform owner)',   'organization'),
    (gen_random_uuid(), 'organization.manage', 'Create and edit organizations (platform owner)', 'organization');
