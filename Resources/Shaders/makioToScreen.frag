#version 420 core

layout (binding = 0) uniform sampler2D inputTexture;

in vec2 texCoords;

layout (location = 0) out vec4 FragColor;

void main()
{
	vec2 IA;
    IA = texture(inputTexture, texCoords).ra;
    float I = IA[0];
    float a = IA[1];
    float hot = 4;
    float warm = 2;
    float cold = 1;
    vec3 color = vec3(pow(I, hot) * vec3(1,1,0) + (pow(I, warm) - pow(I, hot)) * vec3(1,0,0) + (pow(I, cold) - pow(I, warm) - pow(I, hot)) * vec3(0,0,1));
    const float gamma = 0.7;
    const float exposure = 2.0;

    // exposure correction 
    FragColor = vec4(vec3(1.0) - exp(-color * exposure), a);
}