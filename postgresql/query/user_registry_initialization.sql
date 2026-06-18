CREATE TABLE IF NOT EXISTS users
(
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- This column now strictly references the role_permissions table
    role_name VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,

    -- THIS IS THE CONNECTION: It guarantees a user can only have a valid role
    CONSTRAINT fk_users_role
    FOREIGN KEY (role_name)
    REFERENCES role_permissions (role_name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
    );

-- Seed initial users
INSERT INTO users (email, password_hash, role_name, created_at)
VALUES
    ('government@example.com',                              '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Government', CURRENT_TIMESTAMP),
    ('vingroup.company@aerosensei.vn',                     '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vinhomes@aerosensei.vn',                             '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('bid@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vpb@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('petrovietnam.gas@aerosensei.vn',                     '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('hoa.phat.group@aerosensei.vn',                       '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vinfast.auto@aerosensei.vn',                         '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('asia.commercial.joint.stock.bank@aerosensei.vn',     '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('saigon.thuong.tin.commercial.bank@aerosensei.vn',    '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('hdb@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('fpt.corporation@aerosensei.vn',                      '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vinamilk.vietnam.dairy.products@aerosensei.vn',      '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vietjet.aviation@aerosensei.vn',                     '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('masan.group@aerosensei.vn',                          '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vietnam.airlines@aerosensei.vn',                     '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('ssi.securities.corporation@aerosensei.vn',           '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vincom.retail.joint.stock.company@aerosensei.vn',    '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('shb@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('sabeco.brewery.saigon.beer@aerosensei.vn',           '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vib@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('bcm@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vietnam.national.petroleum.group@aerosensei.vn',     '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('ssb@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('bao.viet.holdings@aerosensei.vn',                    '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('msb@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('tpb@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('petrovietnam.power@aerosensei.vn',                   '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('gelex.group.joint.stock.company@aerosensei.vn',      '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('eib@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('ocb.orient.commercial.joint.stock.bank@aerosensei.vn','$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',   CURRENT_TIMESTAMP),
    ('phu.nhuan.jewelry.pnj@aerosensei.vn',                '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('ree@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('hcm@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vietcap.securities@aerosensei.vn',                   '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('kdh@aerosensei.vn',                                  '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('duc.giang.chemicals.group@aerosensei.vn',            '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP),
    ('vinh.hoan.corporation@aerosensei.vn',                '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company',    CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;
