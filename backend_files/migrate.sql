-- Tabela użytkowników
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  role ENUM('admin','member') DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela pakietów
CREATE TABLE packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  credits INT NOT NULL
);

-- Tabela przypisań pakietów do użytkownika
CREATE TABLE user_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  package_id INT NOT NULL,
  assigned_at DATETIME NOT NULL,
  remaining_credits INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (package_id) REFERENCES packages(id)
);

-- Historia zmian kredytów
CREATE TABLE credit_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  `change` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela jednorazowych kodów QR
CREATE TABLE qr_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  credits INT NOT NULL,
  code VARCHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  scanned_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Domyślne pakiety
INSERT INTO packages (name, credits) VALUES
  ('BASIC', 4),
  ('STANDARD', 8),
  ('GOLD', 12),
  ('DIAMOND', 32),
  ('PLATINIUM', 40);
