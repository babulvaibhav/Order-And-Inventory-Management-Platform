package com.uphead.platform.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE = "platform.events";
    public static final String NOTIFICATION_QUEUE = "platform.notifications";
    public static final String ORDER_CREATED_ROUTING_KEY = "order.created";
    public static final String ORDER_CANCELLED_ROUTING_KEY = "order.cancelled";
    public static final String INVENTORY_UPDATED_ROUTING_KEY = "inventory.updated";
    public static final String INVENTORY_LOW_ROUTING_KEY = "inventory.low";
    public static final String INVENTORY_TRANSFER_ROUTING_KEY = "inventory.transfer.completed";

    @Bean
    public TopicExchange exchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(NOTIFICATION_QUEUE).build();
    }

    @Bean
    public Binding notificationBinding() {
        return BindingBuilder.bind(notificationQueue())
                .to(exchange())
                .with("#");
    }

    @Bean
    public MessageConverter messageConverter(ObjectMapper objectMapper) {
        // Must reuse the app's ObjectMapper (JacksonConfig) — a plain `new Jackson2JsonMessageConverter()`
        // builds its own default ObjectMapper with no JavaTimeModule, so any event payload containing a
        // LocalDateTime (e.g. OrderResponse) fails to serialize with "Failed to convert Message content".
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }
}
