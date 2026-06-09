import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public AuthResponse authenticate(String email, String password) {
        // Fetch user from the actual PostgreSQL database
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        // Compare the raw password from frontend with the hashed password in the DB
        // passwordEncoder.matches(rawPassword, encodedPassword) handles the decryption validation safely
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        // Generate tokens if verification passes
        String accessToken = jwtUtils.generateAccessToken(user.getEmail());
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        return new AuthResponse(accessToken, refreshToken);
    }

    public AuthResponse refreshToken(String incomingRefreshToken) {
        if (jwtUtils.validateToken(incomingRefreshToken)) {
            String email = jwtUtils.extractEmail(incomingRefreshToken);

            // Double check that the user still exists in the database before issuing new tokens
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User no longer exists"));

            String newAccessToken = jwtUtils.generateAccessToken(user.getEmail());
            String newRefreshToken = jwtUtils.generateRefreshToken(user.getEmail());

            return new AuthResponse(newAccessToken, newRefreshToken);
        }
        throw new RuntimeException("Invalid Refresh Token");
    }
}