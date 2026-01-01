import Head from 'next/head';

import { withAuth } from '../lib/withAuth';
import MedicalTranscriptionSystem from '../components/MedicalTranscriptionSystem';
import GlobalHeader from '../components/GlobalHeader';

export const getServerSideProps = withAuth(async (context) => {
  const isAuthenticated = context.user ? true : false;
  const user = context.user || null;
  
  return {
    props: {
      isAuthenticated,
      user,
    },
  };
});

export default function Home({ isAuthenticated, user }) {
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-4">
            Medical Transcription System
          </h1>
          <p className="text-gray-600 mb-8">
            Please log in to access the medical transcription system.
          </p>
          <a
            href="/api/auth/login"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Rainbow MedTranscribe</title>
        <meta
          name="description"
          content="AI-powered medical transcription and documentation"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/rainbow-logo.svg" /> 
      </Head>
{/* /Op.png */}
      <div className="relative min-h-screen">
        {/* Global Header */}
        {/* <GlobalHeader user={user} /> */}

        {/* Main Medical Transcription System */}
        <div className="pt-0">
          <MedicalTranscriptionSystem user={user} />
        </div>
      </div>
    </>
  );
}
