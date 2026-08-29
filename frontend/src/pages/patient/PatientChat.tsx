import React from "react";
import Chat from "@/pages/Chat";

export const PatientChat: React.FC = () => {
  return <Chat title="Ask MedSys" eyebrow="CHAT" doctorMode={false} />;
};

export default PatientChat;

