#version 420 core

layout (binding = 0) uniform sampler2D powerDensityTexture;
layout (binding = 0) uniform sampler2D normalTexture;

in vec2 texCoords;

layout (location = 0) out vec4 FragColor;

uniform int visHeight;


void main()
{
	vec2 IA = vec2(0,0);
    for (int x = 0; x < 5; x++) {
        for (int y = 0; y < 5; y++) {
            IA += texture(powerDensityTexture, texCoords + (vec2(x, y) - vec2(2, 2)) / textureSize(powerDensityTexture, 0)).ra;
        }
    }   
    float preMapBrightness = 1.0;
    float preMapGamma = 1.0;
    IA /= 25.0;
    float I = IA[0] * preMapBrightness;
    I = pow(I, 1.0 / preMapGamma);
    float a = IA[1];
    float hot = 4;
    float warm = 2;
    float cold = 1;

    /*
    vec3 color;
    if (I < 0.25) {
        float t = (I) / (0.25);
        color = t * vec3(0.25,0.25,0.25) + (1.0 - t) * vec3(0,0,0);
    }
    else if (I < 0.5) {
        float t = (I - 0.25) / (0.25);
        color = t * vec3(0.5,0.5,0.5) + (1.0 - t) * vec3(0.25,0.25,0.25);
    }
    else if (I < 0.75) {
        float t = (I - 0.5) / (0.25);
        color = I * vec3(0.75,0.75,0.75) + (1.0 - I) * vec3(0.5,0.5,0.5);
    }
    else {
        float t = (I - 0.75) / (0.25);
        color = I * vec3(1,1,1) + (1.0 - I) * vec3(0.75,0.75,0.75);
    }
    FragColor = vec4(color, a);
    */
    
    /*
    // Map color:
    vec3 color = vec3(
    max(pow(I, hot), 0) * vec3(1,1,0)   // Yellow
    + max(pow(I, warm) * (1.0 - pow(I, hot)), 0) * vec3(1,0,0)    // Red
    + max(pow(I, cold) * (1 - pow(I, warm)) * (1 - pow(I, hot)), 0) * vec3(0,0,1)  // Blue
    );
    */
    
    const float brightness = 1.0;
    const float gamma = 1.0;
    const float exposure = 1.0;

    vec3 color = I.xxx * brightness;

    // exposure correction 
    if (visHeight == 0) {   // Render power density
        vec3 corrected = vec3(1.0) - exp(-vec3(pow(color.x, 1.0 / gamma), pow(color.y, 1.0 / gamma), pow(color.z, 1.0 / gamma)) * exposure);
        FragColor = vec4(corrected, a);
    }
    else if (visHeight == 1) {  // Render height
        float h = texture(powerDensityTexture, texCoords).g;
        FragColor = vec4(h.xxx, 1.0);
    }
    else if (visHeight == 2) {  // Render normal
        FragColor = vec4(texture(normalTexture, texCoords).xyz, 1.0);
    }
    
}