#version 420 core
out vec4 IrradianceOut; // ([W/m^2], [m])

in vec2 texCoords;
in vec4 w_rayDir;

uniform int mirrorSampleCountPerPixel;
uniform vec2 mirrorSampleAreaScale;
uniform float wMirrorDistance;
uniform float mirrorShininess;
uniform vec2 wMirrorSize; // Should be (1, 1)
uniform vec2 wCanvasSize; // Should be (1, 1)
uniform vec4 wLightPos;
uniform float lightPowerDensity;

layout (binding = 0) uniform sampler2D mirrorNormalHeightMap;

float m_pi = 3.141592653589793;


float mirrorBRDF(vec3 inDir, vec3 outDir, vec3 normal) {
    float c_n = (mirrorShininess + 2.0) / 2.0 / m_pi;
    float dotNL = dot(normal, inDir);
    float dotNV = dot(normal, outDir);
    return c_n * pow(max(2.0 * dotNL * dotNV - dot(inDir, outDir), 0.0), mirrorShininess)
        / max(dotNL, dotNV);
}

/* Function to linearly interpolate between a0 and a1
 * Weight w should be in the range [0.0, 1.0]
 */
float interpolate(float a0, float a1, float w) {
    /* // You may want clamping by inserting:
     * if (0.0 > w) return a0;
     * if (1.0 < w) return a1;
     */
    return (a1 - a0) * w + a0;
    /* // Use this cubic interpolation [[Smoothstep]] instead, for a smooth appearance:
     * return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
     *
     * // Use [[Smootherstep]] for an even smoother result with a second derivative equal to zero on boundaries:
     * return (a1 - a0) * ((w * (w * 6.0 - 15.0) + 10.0) * w * w * w) + a0;
     */
}


// ------------------------- RANDOM GENERATION ----------------------------------------------

/* Create pseudorandom direction vector
 */
vec2 randomGradient(int ix, int iy) {
    // No precomputed gradients mean this works for any number of grid coordinates
    uint w = 8 * 32;
    uint s = w / 2; // rotation width
    uint a = ix, b = iy;
    a *= 3284157443; b ^= a << s | a >> w-s;
    b *= 1911520717; a ^= b << s | b >> w-s;
    a *= 2048419325;
    float random = a * (3.14159265 / ~(~0u >> 1)); // in [0, 2*Pi]
    vec2 v;
    v.x = cos(random); v.y = sin(random);
    return v;
}

// Computes the dot product of the distance and gradient vectors.
float dotGridGradient(int ix, int iy, float x, float y) {
    // Get gradient from integer coordinates
    vec2 gradient = randomGradient(ix, iy);

    // Compute the distance vector
    float dx = x - float(ix);
    float dy = y - float(iy);

    // Compute the dot-product
    return (dx*gradient.x + dy*gradient.y);
}

// Compute Perlin noise at coordinates x, y
float perlin(float x, float y) {
    // Determine grid cell coordinates
    int x0 = int(floor(x));
    int x1 = x0 + 1;
    int y0 = int(floor(y));
    int y1 = y0 + 1;

    // Determine interpolation weights
    // Could also use higher order polynomial/s-curve here
    float sx = x - float(x0);
    float sy = y - float(y0);

    // Interpolate between grid point gradients
    float n0, n1, ix0, ix1, value;

    n0 = dotGridGradient(x0, y0, x, y);
    n1 = dotGridGradient(x1, y0, x, y);
    ix0 = interpolate(n0, n1, sx);

    n0 = dotGridGradient(x0, y1, x, y);
    n1 = dotGridGradient(x1, y1, x, y);
    ix1 = interpolate(n0, n1, sx);

    value = interpolate(ix0, ix1, sy);
    return value; // Will return in range -1 to 1. To make it in range 0 to 1, multiply by 0.5 and add 0.5
}


void main()
{
    vec3 wCanvasPos = vec3((texCoords - 0.5) * wCanvasSize, 0.0);    // The canvas is always in z = 0 plane.
    vec3 wCanvasNormal = vec3(0, 0, -1);                            // The canvas is always facing ing -z direction.
    dvec2 wMirrorDelta = dvec2(wMirrorSize) / double(mirrorSampleCountPerPixel) * double(mirrorSampleAreaScale);    // The size of a single small square

    double M = 0.0;  // Irradiance of canvas point [W/m^2]
    for (int x = 0; x < mirrorSampleCountPerPixel; x++) {
        for (int y = 0; y < mirrorSampleCountPerPixel; y++) {
            vec2 mirrorUV = texCoords       // Most of the functions work with the [0, 1] uv coordinates.
                + (vec2(x, y) / float(mirrorSampleCountPerPixel) - 0.5) * mirrorSampleAreaScale
                
                + mirrorSampleAreaScale / float(mirrorSampleCountPerPixel)   // Apply noise to sampling
                * (2.0 * vec2(
                    perlin(1001.0 * texCoords.x  + x + x*x, 1011.0 * texCoords.y + y + x*x),
                    perlin(1005.0 * texCoords.x + x - y*y, 1020.0 * texCoords.y - y + x*y)
                ) - 1.0)
                
                ;
            if (mirrorUV.x < 0 || mirrorUV.x > 1 || mirrorUV.y < 0 || mirrorUV.y > 1) {
                continue;   // Skip this position if it is outside of the mirror area.
            }

            vec4 wNormHeight = texture(mirrorNormalHeightMap, mirrorUV);
            vec3 wMirrorPos = vec3((mirrorUV - 0.5) * wMirrorSize, wNormHeight.w - wMirrorDistance);
            vec3 wMirrorNormal = wNormHeight.xyz;
            vec3 wToMirror = normalize(wMirrorPos - wCanvasPos);
            vec3 wToLight = normalize(wLightPos.xyz - wMirrorPos * wLightPos.w);    // Direction if wLightPos.w = 0.
            float wLightDitanceSquare = dot(wToLight, wToLight);
            vec3 wLightDir = wToLight / sqrt(wLightDitanceSquare );
            
            dvec3 dwCanvasPos = dvec3(wCanvasPos);
            double a_x = length(dvec3(wMirrorPos.xy, -wMirrorDistance) - dvec3(wMirrorDelta.x, 0, 0) / 2.0 - dwCanvasPos);
            double b_x = length(dvec3(wMirrorPos.xy, -wMirrorDistance) + dvec3(wMirrorDelta.x, 0, 0) / 2.0 - dwCanvasPos);
            double c_x = wMirrorDelta.x;
            double delta_x = acos(float((a_x * a_x + b_x * b_x - c_x * c_x) / (2.0 * a_x * b_x)));  // Angle in x direction

            double a_y = length(dvec3(wMirrorPos.xy, -wMirrorDistance) - dvec3(0, wMirrorDelta.y, 0) / 2.0 - dwCanvasPos);
            double b_y = length(dvec3(wMirrorPos.xy, -wMirrorDistance) + dvec3(0, wMirrorDelta.y, 0) / 2.0 - dwCanvasPos);
            double c_y = wMirrorDelta.y;
            double delta_y = acos(float((a_y * a_y + b_y * b_y - c_y * c_y) / (2.0 * a_y * b_y)));  // Angle in y direction
            double omega = float(delta_x * delta_y);    // Solid angle

            double Lin =     // Radiance of mirror surface area
                double(lightPowerDensity / wLightDitanceSquare)
                * double(max(dot(wLightDir, wMirrorNormal), 0))
                * double(mirrorBRDF(wLightDir, -wToMirror, wMirrorNormal));   // approximation of integral over Omega (M_l * cos(theta) * BRDF)
            M += double(max(dot(wToMirror, wCanvasNormal), 0)) * Lin * omega;    // approximation of integral over Omega [L_in * cos(theta)] d omega
        }
    }
    IrradianceOut = vec4(M, 0, 0, 1);  // ([W/m^2], [m])
}